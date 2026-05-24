describe('Literary Chat', () => {
  beforeEach(() => {
    cy.visit('/frontend/pages/index.html')
  })

  it('should open chat widget and send a message', () => {
    // Intercept API call to prevent real requests
    cy.intercept('POST', '**/api/v1/chat', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          response: 'This is a mock response from Elara.'
        }
      }
    }).as('chatMsg')

    // Click to open chatbot
    cy.get('#chatbot-toggle-btn').should('be.visible').click()
    
    // Check if chatbot window is visible
    cy.get('#chatbot-window').should('not.have.class', 'hidden')
    
    // Type a message
    cy.get('#chatbot-input').should('be.visible').type('Recommend me a fantasy book')
    
    // Send the message
    cy.get('#chatbot-send-btn').click()
    
    // Check if the user message appears in the chat
    cy.get('#chatbot-messages').should('contain', 'Recommend me a fantasy book')
    
    // Wait for mock response
    cy.wait('@chatMsg')
    
    // Check if the bot message appears
    cy.get('#chatbot-messages').should('contain', 'This is a mock response from Elara.')
  })
})
