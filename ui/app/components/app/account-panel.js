import React, { Component } from 'react'
import Identicon from '../ui/identicon'
import { addressSummary, formatBalance } from '../../helpers/utils/util'

export default class AccountPanel extends Component {
  render () {
    const state = this.props
    const identity = state.identity || {}
    const account = state.account || {}
    const isFauceting = state.isFauceting

    const panelState = {
      key: `accountPanel${identity.address}`,
      identiconKey: identity.address,
      identiconLabel: identity.name || '',
      attributes: [
        {
          key: 'ADDRESS',
          value: addressSummary(identity.address),
        },
        balanceOrFaucetingIndication(account, isFauceting),
      ],
    }

    return (
      <div
        className="identity-panel flex-row flex-space-between"
        style={{
          flex: '1 0 auto',
          cursor: panelState.onClick ? 'pointer' : undefined,
        }}
        onClick={panelState.onClick}
      >
        <div className="identicon-wrapper flex-column select-none">
          <Identicon
            address={panelState.identiconKey}
            imageify={state.imageifyIdenticons}
          />
          <span className="font-small">
            {panelState.identiconLabel.substring(0, 7) + '...'}
          </span>
        </div>
        <div className="identity-data flex-column flex-justify-center flex-grow select-none">
          {panelState.attributes.map((attr, index) => (
            <div className="flex-row flex-space-between" key={index}>
              <label className="font-small no-select">{attr.key}</label>
              <span className="font-small">{attr.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

function balanceOrFaucetingIndication (account) {
  return {
    key: 'BALANCE',
    value: formatBalance(account.balance),
  }
}
