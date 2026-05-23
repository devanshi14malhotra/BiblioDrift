describe('Vault Interaction', () => {
  beforeEach(() => {
    // Set a mock session so the auth barrier is hidden
    cy.window().then((win) => {
      win.localStorage.setItem('bibliodrift_session', 'authenticated_mock_user')
    })
    cy.visit('/frontend/pages/vault.html')
  })

  it('should display the secure deck and allow file selection', () => {
    // The secure deck should be visible
    cy.get('#secureDeck').should('be.visible')
    cy.get('#authBarrier').should('not.be.visible')
    
    // Check if the dropzone exists
    cy.get('#dropZone').should('exist')
    
    // Use selectFile for a real interaction
    cy.writeFile('cypress/fixtures/testbook.pdf', 'dummy pdf content')
    cy.get('#vaultFileInput').selectFile('cypress/fixtures/testbook.pdf', { force: true })
    
    // Wait for the UI to update and show the fields
    cy.get('#detailsRevealer').should('have.class', 'active')
    
    cy.get('#vaultBookTitle').should('have.value', 'testbook')
    cy.get('#vaultBookAuthor').should('be.visible').type('Jane Doe')
    cy.get('#vaultBookPrivacy').select('private')
    
    // Optionally trigger an upload and verify state changes
    cy.get('#uploadBtn').click()
    cy.get('#vault-shelf-row').should('exist') // Or any other post-upload assertion
  })
})
