import { connect } from 'react-redux'
import {
  accountsWithSendEtherInfoSelector,
  getSendEnsResolution,
  getCurrentNetwork,
  getSendEnsResolutionError,
} from '../../send.selectors.js'
import {
  getAddressBook,
  getAddressBookEntry,
} from '../../../../selectors/selectors'
import { updateSendTo } from '../../../../store/actions'
import AddRecipient from './add-recipient.component'

export default connect(mapStateToProps, mapDispatchToProps)(AddRecipient)

function mapStateToProps(state) {
  const ensResolution = getSendEnsResolution(state)

  let addressBookEntryName = ''
  if (ensResolution) {
    const addressBookEntry = getAddressBookEntry(state, ensResolution) || {}
    addressBookEntryName = addressBookEntry.name
  }

  const addressBook = getAddressBook(state)

  return {
    network: parseInt(getCurrentNetwork(state), 10),
    ownedAccounts: accountsWithSendEtherInfoSelector(state),
    addressBook,
    ensResolution,
    addressBookEntryName,
    ensResolutionError: getSendEnsResolutionError(state),
    contacts: addressBook.filter(({ name }) => !!name),
    nonContacts: addressBook.filter(({ name }) => !name),
  }
}

function mapDispatchToProps(dispatch) {
  return {
    updateSendTo: (to, nickname, opt) =>
      dispatch(updateSendTo(to, nickname, opt)),
  }
}
