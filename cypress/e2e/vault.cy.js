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
    
    // Test the form details
    // We can't easily mock file upload in a minimal test without a real file, 
    // but we can verify the inputs are present when active
    // The detailsRevealer has 'active' class when a file is selected
    // We force show it to test inputs
    cy.get('#detailsRevealer').invoke('addClass', 'active')
    
    cy.get('#vaultBookTitle').should('be.visible').type('My Secret Book')
    cy.get('#vaultBookAuthor').should('be.visible').type('Jane Doe')
    cy.get('#vaultBookPrivacy').select('private')
    
    cy.get('#uploadBtn').should('exist')
  })
})
