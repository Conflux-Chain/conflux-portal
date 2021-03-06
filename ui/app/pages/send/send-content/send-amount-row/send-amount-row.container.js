import { connect } from 'react-redux'
import {
  getAmountConversionRate,
  getConversionRate,
  getGasTotal,
  getPrimaryCurrency,
  getSelectedToken,
  getSendAmount,
  getSendFromBalance,
  getTokenBalance,
  getSponsorshipInfo,
} from '../../send.selectors'
import { sendAmountIsInError } from './send-amount-row.selectors'
import { getAmountErrorObject, getGasFeeErrorObject } from '../../send.utils'
import { setMaxModeTo, updateSendAmount } from '../../../../store/actions'
import { updateSendErrors } from '../../../../ducks/send/send.duck'
import SendAmountRow from './send-amount-row.component'

export default connect(mapStateToProps, mapDispatchToProps)(SendAmountRow)

function mapStateToProps (state) {
  const sponsorshipInfo = getSponsorshipInfo(state) || {
    willUserPayTxFee: true,
  }
  const { willUserPayTxFee } = sponsorshipInfo
  const gasTotal = getGasTotal(state)
  return {
    gasTotalCountSponsorshipInfo: willUserPayTxFee ? gasTotal : '0',
    amount: getSendAmount(state),
    amountConversionRate: getAmountConversionRate(state),
    balance: getSendFromBalance(state),
    conversionRate: getConversionRate(state),
    inError: sendAmountIsInError(state),
    primaryCurrency: getPrimaryCurrency(state),
    selectedToken: getSelectedToken(state),
    tokenBalance: getTokenBalance(state),
  }
}

function mapDispatchToProps (dispatch) {
  return {
    setMaxModeTo: (bool) => dispatch(setMaxModeTo(bool)),
    updateSendAmount: (newAmount) => dispatch(updateSendAmount(newAmount)),
    updateGasFeeError: (amountDataObject) => {
      dispatch(updateSendErrors(getGasFeeErrorObject(amountDataObject)))
    },
    updateSendAmountError: (amountDataObject) => {
      dispatch(updateSendErrors(getAmountErrorObject(amountDataObject)))
    },
  }
}
