import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import Tooltip from '../../ui/tooltip-v2'
import Spinner from '../../ui/spinner'

import {
  UNAPPROVED_STATUS,
  REJECTED_STATUS,
  APPROVED_STATUS,
  EXECUTED_STATUS,
  SIGNED_STATUS,
  SUBMITTED_STATUS,
  CONFIRMED_STATUS,
  FAILED_STATUS,
  DROPPED_STATUS,
  CANCELLED_STATUS,
  SKIPPED_STATUS,
  BUGGED_STATUS,
} from '../../../helpers/constants/transactions'

const statusToClassNameHash = {
  [BUGGED_STATUS]: 'transaction-status--bugged',
  [UNAPPROVED_STATUS]: 'transaction-status--unapproved',
  [REJECTED_STATUS]: 'transaction-status--rejected',
  [APPROVED_STATUS]: 'transaction-status--approved',
  [SIGNED_STATUS]: 'transaction-status--signed',
  [SUBMITTED_STATUS]: 'transaction-status--submitted',
  [EXECUTED_STATUS]: 'transaction-status--submitted',
  [CONFIRMED_STATUS]: 'transaction-status--confirmed',
  [FAILED_STATUS]: 'transaction-status--failed',
  [SKIPPED_STATUS]: 'transaction-status--skipped',
  [DROPPED_STATUS]: 'transaction-status--dropped',
  [CANCELLED_STATUS]: 'transaction-status--failed',
}

const statusToTextHash = {
  [SUBMITTED_STATUS]: 'pending',
  [EXECUTED_STATUS]: 'executed',
}

export default class TransactionStatus extends PureComponent {
  static defaultProps = {
    title: null,
  }

  static contextTypes = {
    t: PropTypes.func,
  }

  static propTypes = {
    statusKey: PropTypes.string,
    className: PropTypes.string,
    title: PropTypes.string,
  }

  render() {
    const { className, statusKey, title } = this.props
    const statusText = this.context.t(statusToTextHash[statusKey] || statusKey)

    return (
      <div
        className={classnames(
          'transaction-status',
          className,
          statusToClassNameHash[statusKey]
        )}
      >
        {statusToTextHash[statusKey] === 'pending' ||
        statusToTextHash[statusKey] === 'executed' ? (
          <Spinner className="transaction-status__pending-spinner" />
        ) : null}
        <Tooltip
          position="top"
          title={
            statusKey === 'bugged' ? this.context.t('buggedTxTooltip') : title
          }
        >
          {statusText}
        </Tooltip>
      </div>
    )
  }
}
