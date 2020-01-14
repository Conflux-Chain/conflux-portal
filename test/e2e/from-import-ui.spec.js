const assert = require('assert')
const webdriver = require('selenium-webdriver')

const { By, Key, until } = webdriver
const { tinyDelayMs, regularDelayMs, largeDelayMs } = require('./helpers')
const { buildWebDriver } = require('./webdriver')
const Ganache = require('./ganache')
const enLocaleMessages = require('../../app/_locales/en/messages.json')

const ganacheServer = new Ganache()

describe('Using MetaMask with an existing account', function () {
  let driver

  const testSeedPhrase =
    'forum vessel pink push lonely enact gentle tail admit parrot grunt dress'
  const testAddress = '0x0Cc5261AB8cE458dc977078A3623E2BaDD27afD3'
  const testPrivateKey2 =
    '14abe6f4aab7f9f626fe981c864d0adeb5685f289ac9270c27b8fd790b4235d6'
  const testPrivateKey3 =
    'F4EC2590A0C10DE95FBF4547845178910E40F5035320C516A18C117DE02B5669'

  this.timeout(0)
  this.bail(true)

  before(async function () {
    await ganacheServer.start({
      accounts: [
        {
          secretKey:
            '0x53CB0AB5226EEBF4D872113D98332C1555DC304443BEE1CF759D15798D3C55A9',
          balance: 25000000000000000000,
        },
      ],
    })
    const result = await buildWebDriver()
    driver = result.driver
  })

  afterEach(async function () {
    if (process.env.SELENIUM_BROWSER === 'chrome') {
      const errors = await driver.checkBrowserForConsoleErrors(driver)
      if (errors.length) {
        const errorReports = errors.map(err => err.message)
        const errorMessage = `Errors found in browser console:\n${errorReports.join(
          '\n'
        )}`
        console.error(new Error(errorMessage))
      }
    }
    if (this.currentTest.state === 'failed') {
      await driver.verboseReportOnFailure(driver, this.currentTest)
    }
  })

  after(async function () {
    await ganacheServer.quit()
    await driver.quit()
  })

  describe('First time flow starting from an existing seed phrase', () => {
    it('clicks the continue button on the welcome screen', async () => {
      await driver.findElement(By.css('.welcome-page__header'))
      const welcomeScreenBtn = await driver.findElement(
        By.xpath(
          `//button[contains(text(), '${enLocaleMessages.getStarted.message}')]`
        )
      )
      welcomeScreenBtn.click()
      await driver.delay(largeDelayMs)
    })

    it('clicks the "Import Wallet" option', async () => {
      const customRpcButton = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Import Wallet')]`)
      )
      customRpcButton.click()
      await driver.delay(largeDelayMs)
    })

    it('clicks the "No thanks" option on the metametrics opt-in screen', async () => {
      const optOutButton = await driver.findElement(By.css('.btn-default'))
      optOutButton.click()
      await driver.delay(largeDelayMs)
    })

    it('imports a seed phrase', async () => {
      const [seedTextArea] = await driver.findElements(
        By.css('textarea.first-time-flow__textarea')
      )
      await seedTextArea.sendKeys(testSeedPhrase)
      await driver.delay(regularDelayMs)

      const [password] = await driver.findElements(By.id('password'))
      await password.sendKeys('correct horse battery staple')
      const [confirmPassword] = await driver.findElements(
        By.id('confirm-password')
      )
      confirmPassword.sendKeys('correct horse battery staple')

      const tosCheckBox = await driver.findElement(
        By.css('.first-time-flow__checkbox')
      )
      await tosCheckBox.click()

      const [importButton] = await driver.findElements(
        By.xpath(`//button[contains(text(), 'Import')]`)
      )
      await importButton.click()
      await driver.delay(regularDelayMs)
    })

    it('clicks through the success screen', async () => {
      await driver.findElement(
        By.xpath(`//div[contains(text(), 'Congratulations')]`)
      )
      const doneButton = await driver.findElement(
        By.xpath(
          `//button[contains(text(), '${enLocaleMessages.endOfFlowMessage10.message}')]`
        )
      )
      await doneButton.click()
      await driver.delay(regularDelayMs)
    })
  })

  describe('Show account information', () => {
    it('shows the correct account address', async () => {
      const accountDetailsButton = await driver.findElement(
        By.css('.account-details__details-button')
      )
      await accountDetailsButton.click()
      await driver.findVisibleElement(By.css('.qr-wrapper'))
      await driver.delay(regularDelayMs)

      const [address] = await driver.findElements(
        By.css('input.qr-ellip-address')
      )
      assert.equal(await address.getAttribute('value'), testAddress)

      const accountModalClose = await driver.findElement(
        By.css('.account-modal-close')
      )
      await accountModalClose.click()
      await driver.delay(largeDelayMs)
    })

    it('shows a QR code for the account', async () => {
      const accountDetailsButton = await driver.findElement(
        By.css('.account-details__details-button')
      )
      await accountDetailsButton.click()
      await driver.findVisibleElement(By.css('.qr-wrapper'))
      const detailModal = await driver.findElement(By.css('span .modal'))
      await driver.delay(regularDelayMs)

      const accountModalClose = await driver.findElement(
        By.css('.account-modal-close')
      )
      await accountModalClose.click()
      await driver.wait(until.stalenessOf(detailModal))
      await driver.delay(regularDelayMs)
    })
  })

  describe('Log out and log back in', () => {
    it('logs out of the account', async () => {
      const accountIdenticon = await driver.findElement(
        By.css('.account-menu__icon .identicon')
      )
      await accountIdenticon.click()
      await driver.delay(regularDelayMs)

      const [logoutButton] = await driver.findElements(
        By.css('.account-menu__logout-button')
      )
      assert.equal(await logoutButton.getText(), 'Log out')
      await logoutButton.click()
      await driver.delay(regularDelayMs)
    })

    it('accepts the account password after lock', async () => {
      const passwordField = await driver.findElement(By.id('password'))
      await passwordField.sendKeys('correct horse battery staple')
      await passwordField.sendKeys(Key.ENTER)
      await driver.delay(largeDelayMs)
    })
  })

  describe('Add an account', () => {
    it('switches to localhost', async () => {
      const networkDropdown = await driver.findElement(By.css('.network-name'))
      await networkDropdown.click()
      await driver.delay(regularDelayMs)

      const [localhost] = await driver.findElements(
        By.xpath(`//span[contains(text(), 'Localhost')]`)
      )
      await localhost.click()
      await driver.delay(largeDelayMs)
    })

    it('choose Create Account from the account menu', async () => {
      const accountMenuButton = await driver.findElement(
        By.css('.account-menu__icon')
      )
      await accountMenuButton.click()
      await driver.delay(regularDelayMs)

      const [createAccount] = await driver.findElements(
        By.xpath(`//div[contains(text(), 'Create Account')]`)
      )
      await createAccount.click()
      await driver.delay(regularDelayMs)
    })

    it('set account name', async () => {
      const [accountName] = await driver.findElements(
        By.css('.new-account-create-form input')
      )
      await accountName.sendKeys('2nd account')
      await driver.delay(regularDelayMs)

      const [createButton] = await driver.findElements(
        By.xpath(`//button[contains(text(), 'Create')]`)
      )
      await createButton.click()
      await driver.delay(regularDelayMs)
    })

    it('should show the correct account name', async () => {
      const [accountName] = await driver.findElements(
        By.css('.account-details__account-name')
      )
      assert.equal(await accountName.getText(), '2nd account')
      await driver.delay(regularDelayMs)
    })
  })

  describe('Switch back to original account', () => {
    it('chooses the original account from the account menu', async () => {
      const accountMenuButton = await driver.findElement(
        By.css('.account-menu__icon')
      )
      await accountMenuButton.click()
      await driver.delay(regularDelayMs)

      const [originalAccountMenuItem] = await driver.findElements(
        By.css('.account-menu__name')
      )
      await originalAccountMenuItem.click()
      await driver.delay(regularDelayMs)
    })
  })

  describe('Send ETH from inside MetaMask', () => {
    it('starts a send transaction', async function () {
      const sendButton = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Send')]`)
      )
      await sendButton.click()
      await driver.delay(regularDelayMs)

      const inputAddress = await driver.findElement(
        By.css('input[placeholder="Search, public address (0x), or ENS"]')
      )
      await inputAddress.sendKeys('0x2f318C334780961FB129D2a6c30D0763d9a5C970')

      const inputAmount = await driver.findElement(By.css('.unit-input__input'))
      await inputAmount.sendKeys('1')

      // Set the gas limit
      const configureGas = await driver.findElement(
        By.css('.advanced-gas-options-btn')
      )
      await configureGas.click()
      await driver.delay(regularDelayMs)

      const gasModal = await driver.findElement(By.css('span .modal'))
      const save = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Save')]`)
      )
      await save.click()
      await driver.wait(until.stalenessOf(gasModal))
      await driver.delay(regularDelayMs)

      // Continue to next screen
      const nextScreen = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Next')]`)
      )
      await nextScreen.click()
      await driver.delay(regularDelayMs)
    })

    it('confirms the transaction', async function () {
      const confirmButton = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Confirm')]`)
      )
      await confirmButton.click()
      await driver.delay(regularDelayMs)
    })

    it('finds the transaction in the transactions list', async function () {
      await driver.wait(async () => {
        const confirmedTxes = await driver.findElements(
          By.css(
            '.transaction-list__completed-transactions .transaction-list-item'
          )
        )
        return confirmedTxes.length === 1
      }, 10000)

      const txValues = await driver.findElements(
        By.css('.transaction-list-item__amount--primary')
      )
      assert.equal(txValues.length, 1)
      assert.ok(/-1\s*ETH/.test(await txValues[0].getText()))
    })
  })

  describe('Imports an account with private key', () => {
    it('choose Create Account from the account menu', async () => {
      const accountMenuButton = await driver.findElement(
        By.css('.account-menu__icon')
      )
      await accountMenuButton.click()
      await driver.delay(regularDelayMs)

      const [importAccount] = await driver.findElements(
        By.xpath(`//div[contains(text(), 'Import Account')]`)
      )
      await importAccount.click()
      await driver.delay(regularDelayMs)
    })

    it('enter private key', async () => {
      const privateKeyInput = await driver.findElement(
        By.css('#private-key-box')
      )
      await privateKeyInput.sendKeys(testPrivateKey2)
      await driver.delay(regularDelayMs)
      const importButtons = await driver.findElements(
        By.xpath(`//button[contains(text(), 'Import')]`)
      )
      await importButtons[0].click()
      await driver.delay(regularDelayMs)
    })

    it('should show the correct account name', async () => {
      const [accountName] = await driver.findElements(
        By.css('.account-details__account-name')
      )
      assert.equal(await accountName.getText(), 'Account 4')
      await driver.delay(regularDelayMs)
    })

    it('should show the imported label', async () => {
      const [importedLabel] = await driver.findElements(
        By.css('.account-details__keyring-label')
      )
      assert.equal(await importedLabel.getText(), 'IMPORTED')
      await driver.delay(regularDelayMs)
    })
  })

  describe('Imports and removes an account', () => {
    it('choose Create Account from the account menu', async () => {
      const accountMenuButton = await driver.findElement(
        By.css('.account-menu__icon')
      )
      await accountMenuButton.click()
      await driver.delay(regularDelayMs)

      const [importAccount] = await driver.findElements(
        By.xpath(`//div[contains(text(), 'Import Account')]`)
      )
      await importAccount.click()
      await driver.delay(regularDelayMs)
    })

    it('enter private key', async () => {
      const privateKeyInput = await driver.findElement(
        By.css('#private-key-box')
      )
      await privateKeyInput.sendKeys(testPrivateKey3)
      await driver.delay(regularDelayMs)
      const importButtons = await driver.findElements(
        By.xpath(`//button[contains(text(), 'Import')]`)
      )
      await importButtons[0].click()
      await driver.delay(regularDelayMs)
    })

    it('should open the remove account modal', async () => {
      const [accountName] = await driver.findElements(
        By.css('.account-details__account-name')
      )
      assert.equal(await accountName.getText(), 'Account 5')
      await driver.delay(regularDelayMs)

      const accountMenuButton = await driver.findElement(
        By.css('.account-menu__icon')
      )
      await accountMenuButton.click()
      await driver.delay(regularDelayMs)

      const accountListItems = await driver.findElements(
        By.css('.account-menu__account')
      )
      assert.equal(accountListItems.length, 5)

      const removeAccountIcons = await driver.findElements(
        By.css('.remove-account-icon')
      )
      await removeAccountIcons[1].click()
      await driver.delay(tinyDelayMs)

      await driver.findElement(By.css('.confirm-remove-account__account'))
    })

    it('should remove the account', async () => {
      const removeButton = await driver.findElement(
        By.xpath(`//button[contains(text(), 'Remove')]`)
      )
      await removeButton.click()

      await driver.delay(regularDelayMs)

      const [accountName] = await driver.findElements(
        By.css('.account-details__account-name')
      )
      assert.equal(await accountName.getText(), 'Account 1')
      await driver.delay(regularDelayMs)

      const accountListItems = await driver.findElements(
        By.css('.account-menu__account')
      )
      assert.equal(accountListItems.length, 4)
    })
  })

  describe('Connects to a Hardware wallet', () => {
    it('choose Connect Hardware Wallet from the account menu', async () => {
      const [connectAccount] = await driver.findElements(
        By.xpath(`//div[contains(text(), 'Connect Hardware Wallet')]`)
      )
      await connectAccount.click()
      await driver.delay(regularDelayMs)
    })

    it('should open the TREZOR Connect popup', async () => {
      const trezorButton = await driver.findElements(By.css('.hw-connect__btn'))
      await trezorButton[1].click()
      await driver.delay(regularDelayMs)
      const connectButtons = await driver.findElements(
        By.xpath(`//button[contains(text(), 'Connect')]`)
      )
      await connectButtons[0].click()
      await driver.delay(regularDelayMs)
      const allWindows = await driver.getAllWindowHandles()
      assert.equal(allWindows.length, 2)
    })
  })
})
