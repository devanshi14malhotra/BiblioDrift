describe('Authentication', () => {
  it('should allow user to toggle between login and register and submit form', () => {
    cy.visit('/frontend/pages/auth.html')
    
    // Intercept login request
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 200,
      body: { success: true, data: { user: { name: 'Demo User' } } }
    }).as('loginReq')
    
    // Check initial state (Login)
    cy.get('#authTitle').should('contain', 'Welcome Back')
    cy.get('#email').clear().type('demo@bibliodrift.com')
    cy.get('#password').clear().type('demo123')
    
    // Submit login form
    cy.get('#authForm').submit()
    
    // Verify API call was made with correct data
    cy.wait('@loginReq').its('request.body').should('deep.include', {
      email: 'demo@bibliodrift.com',
      password: 'demo123'
    })
    
    // Toggle to Register and test state changes
    cy.get('#toggleText').click()
    cy.get('#authTitle').should('contain', 'Create Account')
    cy.get('#nameField').should('be.visible')
  })
})
