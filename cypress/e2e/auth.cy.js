describe('Authentication', () => {
  it('should allow user to toggle between login and register and fill form', () => {
    cy.visit('/frontend/pages/auth.html')
    
    // Check initial state (Login)
    cy.get('#authTitle').should('contain', 'Welcome Back')
    cy.get('#submitBtn').should('contain', 'Sign In')
    cy.get('#email').should('be.visible')
    cy.get('#password').should('be.visible')
    
    // Toggle to Register
    cy.get('#toggleText').click()
    cy.get('#authTitle').should('contain', 'Create Account')
    cy.get('#submitBtn').should('contain', 'Sign Up')
    cy.get('#nameField').should('be.visible')
    cy.get('#username').type('Test User')
    
    // Fill in credentials
    cy.get('#email').clear().type('testuser@bibliodrift.com')
    cy.get('#password').clear().type('password123')
    
    // Since we don't have a backend mock, we just verify the form exists and works visually
    // cy.get('#authForm').submit() // We won't actually submit to avoid errors
  })
})
