import { combineReducers } from 'redux'
import metamaskReducer from './metamask/metamask'
import localeMessagesReducer from './locale/locale'
import sendReducer from './send/send.duck'
import appStateReducer from './app/app'
import confirmTransactionReducer from './confirm-transaction/confirm-transaction.duck'
import gasReducer from './gas/gas.duck'
import storageLimitReducer from './storageLimit/storageLimit.duck'
import gasAndCollateralReducer from './gasAndCollateral/gasAndCollateral.duck'
import sponsorshipReducer from './sponsorship/sponsorship.duck'

export default combineReducers({
  activeTab: (s) => (s === undefined ? null : s),
  metamask: metamaskReducer,
  appState: appStateReducer,
  send: sendReducer,
  confirmTransaction: confirmTransactionReducer,
  gas: gasReducer,
  storageLimit: storageLimitReducer,
  gasAndCollateral: gasAndCollateralReducer,
  localeMessages: localeMessagesReducer,
  sponsorship: sponsorshipReducer,
})
