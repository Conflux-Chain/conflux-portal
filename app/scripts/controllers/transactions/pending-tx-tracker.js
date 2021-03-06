import log from 'loglevel'
import EventEmitter from 'safe-event-emitter'
import EthQuery from '../../ethjs-query'
import { parseRiskByte } from '../../lib/util'

/**

  Event emitter utility class for tracking the transactions as they<br>
  go from a pending state to a confirmed (mined in a block) state<br>
<br>
  As well as continues broadcast while in the pending state
<br>
@param {Object} config - non optional configuration object consists of:
    @param {Object} config.provider - A network provider.
    @param {Object} config.nonceTracker see nonce tracker
    @param {function} config.getPendingTransactions a function for getting an array of transactions,
    @param {function} config.publishTransaction a async function for publishing raw transactions,


@class
*/

class PendingTransactionTracker extends EventEmitter {
  constructor(config) {
    super()
    this.droppedBuffer = {}
    this.query = new EthQuery(config.provider)
    this.nonceTracker = config.nonceTracker
    this.getPendingTransactions = config.getPendingTransactions
    this.getCompletedTransactions = config.getCompletedTransactions
    this.publishTransaction = config.publishTransaction
    this.approveTransaction = config.approveTransaction
  }

  /**
    checks the network for signed txs and releases the nonce global lock if it is
  */
  async updatePendingTxs() {
    // in order to keep the nonceTracker accurate we block it while updating pending transactions
    const nonceGlobalLock = await this.nonceTracker.getGlobalLock()
    try {
      const pendingTxs = this.getPendingTransactions()
      await Promise.all(pendingTxs.map(txMeta => this._checkPendingTx(txMeta)))
    } catch (err) {
      log.error(
        'PendingTransactionTracker - Error updating pending transactions'
      )
      log.error(err)
    }
    nonceGlobalLock.releaseLock()
  }

  /**
    Will resubmit any transactions who have not been confirmed in a block
    @param {Object} block - a block object
    @emits tx:warning
  */
  resubmitPendingTxs(epochNumber) {
    // submitted/executed/approved tx
    const pending = this.getPendingTransactions()
    // only try resubmitting if their are transactions to resubmit
    if (!pending.length) {
      return
    }
    pending.forEach(txMeta =>
      this._resubmitTx(txMeta, epochNumber).catch(err => {
        /*
      Dont marked as failed if the error is a "known" transaction warning
      "there is already a transaction with the same sender-nonce
      but higher/same gas price"

      Also don't mark as failed if it has ever been broadcast successfully.
      A successful broadcast means it may still be mined.
      */
        const errorMessage = err.message.toLowerCase()
        const isKnownTx =
          // geth
          errorMessage.includes('replacement transaction underpriced') ||
          errorMessage.includes('known transaction') ||
          // parity
          errorMessage.includes('gas price too low to replace') ||
          errorMessage.includes(
            'transaction with the same hash was already imported'
          ) ||
          // other
          errorMessage.includes('gateway timeout') ||
          errorMessage.includes('nonce too low') ||
          // cfx
          errorMessage.includes('too stale nonce') ||
          errorMessage.includes('with same nonce already inserted') ||
          errorMessage.includes('discarded due to a too stale nonce') ||
          errorMessage.includes('tx already exist')

        // ignore resubmit warnings, return early
        if (isKnownTx) {
          return
        }
        // encountered real error - transition to error state
        txMeta.warning = {
          error: errorMessage,
          message: 'There was an error when resubmitting this transaction.',
        }
        this.emit('tx:warning', txMeta, err)
      })
    )
  }

  /**
    resubmits the individual txMeta used in resubmitPendingTxs
    @param {Object} txMeta - txMeta object
    @param {string} latestBlockNumber - hex string for the latest block number
    @emits tx:retry
    @returns {string} - txHash
  */
  async _resubmitTx(txMeta, latestBlockNumber) {
    if (!txMeta?.txParams?.epochHeight) {
      return
    }

    if (txMeta?.status === 'executed' || txMeta?.status === 'confirmed') {
      return
    }
    const proposedEpochHeight = txMeta?.txParams?.epochHeight
    const txBlockDistance =
      Number.parseInt(latestBlockNumber, 16) -
      Number.parseInt(proposedEpochHeight, 16)

    const retryCount = txMeta.retryCount || 0

    // Exponential backoff to limit retries at publishing
    if (txBlockDistance <= Math.pow(2, retryCount) + 4) {
      return
    }

    // Only auto-submit already-signed txs:
    if (
      !txMeta?.rawTx &&
      (txMeta.status === 'approved' ||
        txMeta.status === 'signed' ||
        txMeta.status === 'submitted')
    ) {
      return this.emit('tx:bugged', txMeta)
      // return this.approveTransaction(txMeta.id)
    }

    if (!txMeta?.rawTx) {
      return
    }

    const rawTx = txMeta.rawTx
    const txHash = await this.publishTransaction(rawTx)

    // Increment successful tries:
    this.emit('tx:retry', txMeta)
    return txHash
  }

  /**
    Ask the network for the transaction to see if it has been include in a block
    @param {Object} txMeta - the txMeta object
    @emits tx:failed
    @emits tx:dropped
    @emits tx:confirmed
    @emits tx:warning
  */
  async _checkPendingTx(txMeta) {
    if (txMeta.status === 'executed') {
      return this._checkExecutedTransactions(txMeta)
    }

    const txHash = txMeta.hash
    const txId = txMeta.id

    // Only check submitted and executed txs
    if (txMeta.status !== 'submitted') {
      return
    }

    // extra check in case there was an uncaught error during the
    // signature and submission process
    if (!txHash) {
      const noTxHashErr = new Error(
        'We had an error while submitting this transaction, please try again.'
      )
      noTxHashErr.name = 'NoTxHashError'
      this.emit('tx:failed', txId, noTxHashErr)

      return
    }
    // *note to self* hard failure point
    const transactionReceipt =
      txMeta.txReceipt || (await this.query.getTransactionReceipt(txHash))

    // status depends on data form cfx_getTransactionReceipt
    // getTransactionByHash has blockHash - mined
    // getTransactionReceipt has outcomeStatus === '0x0' - executed
    // risk getRiskCoefficient(receipt.epochNumber) has < threshold - confirmed
    // when outcomeStatus === '0x1' failed but lost gas

    // If another tx with the same nonce is mined, set as dropped.
    const taken = await this._checkIfNonceIsTaken(txMeta)
    let dropped
    try {
      // check the network if the nonce is ahead the tx
      // and the tx has not been mined into a block
      dropped = await this._checkIftxWasDropped(txMeta, transactionReceipt)
      // the dropped buffer is in case we ask a node for the tx
      // that is behind the node we asked for tx count
      // IS A SECURITY FOR HITTING NODES IN INFURA THAT COULD GO OUT
      // OF SYNC.
      // on the next block event it will return fire as dropped
      if (typeof this.droppedBuffer[txHash] !== 'number') {
        this.droppedBuffer[txHash] = 0
      }

      // 3 block count buffer
      if (dropped && this.droppedBuffer[txHash] < 3) {
        dropped = false
        ++this.droppedBuffer[txHash]
      }

      if (dropped && this.droppedBuffer[txHash] === 3) {
        // clean up
        delete this.droppedBuffer[txHash]
      }
    } catch (e) {
      log.error(e)
    }

    if (taken || dropped) {
      return this.emit('tx:dropped', txId)
    }

    // get latest transaction status
    try {
      if (!transactionReceipt) {
        return
      }
      const { outcomeStatus, epochNumber } = transactionReceipt

      if (parseInt(outcomeStatus) !== 0) {
        const outcomeStatusErr = new Error(
          'Out of gas or contract execution error'
        )
        outcomeStatusErr.name = 'OutcomeStatusErr'
        this.emit('tx:failed', txId, outcomeStatusErr)
      } else if (epochNumber) {
        this.emit('tx:executed', txId, transactionReceipt)
      }
    } catch (err) {
      txMeta.warning = {
        error: err.message,
        message: 'There was a problem loading this transaction.',
      }
      this.emit('tx:warning', txMeta, err)
    }
  }

  async _checkExecutedTransactions(txMeta) {
    const txHash = txMeta.hash
    const txId = txMeta.id

    const transactionReceipt =
      txMeta.txReceipt || (await this.query.getTransactionReceipt(txHash))

    if (!transactionReceipt) {
      return
    }

    try {
      const risk = await this.query.getConfirmationRiskByHash(
        transactionReceipt.blockHash
      )
      if (risk && parseRiskByte(risk).lessThanOrEqualTo(1e-8)) {
        this.emit('tx:confirmed', txId)
      }
    } catch (err) {
      txMeta.warning = {
        error: err.message,
        message: 'There was a problem loading this executed transaction.',
      }
      this.emit('tx:warning', txMeta, err)
    }
  }

  /**
    checks to see if the tx's nonce has been used by another transaction
    @param {Object} txMeta - txMeta object
    @param {Object} transactionReceipt - transactionReceipt object
    @emits tx:dropped
    @returns {boolean}
  */

  async _checkIftxWasDropped(txMeta, transactionReceipt) {
    const {
      txParams: { nonce, from },
    } = txMeta
    const nextNonce = await this.query.getTransactionCount(from)
    if (
      (!transactionReceipt || !transactionReceipt.epochNumber) &&
      parseInt(nextNonce) > parseInt(nonce)
    ) {
      return true
    }
    return false
  }

  /**
    checks local txs to see if a confirmed txMeta has the same nonce
    @param {Object} txMeta - txMeta object
    @returns {boolean}
  */

  async _checkIfNonceIsTaken(txMeta) {
    const address = txMeta.txParams.from
    const completed = this.getCompletedTransactions(address)
    const sameNonce = completed.filter(otherMeta => {
      if (otherMeta.id === txMeta.id) {
        return false
      }
      return otherMeta.txParams.nonce === txMeta.txParams.nonce
    })
    return sameNonce.length > 0
  }
}

export default PendingTransactionTracker
