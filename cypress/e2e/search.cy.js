describe('Book Search', () => {
  beforeEach(() => {
    cy.visit('/frontend/pages/index.html')
  })

  it('should allow user to type in the search bar', () => {
    // Intercept API call to prevent real requests
    cy.intercept('POST', '**/api/v1/mood-search', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          books: [
            { id: '1', title: 'Mocked Book', author: 'Mock Author', cover_url: '' }
          ]
        }
      }
    }).as('moodSearch')

    // Find and interact with search input
    cy.get('#searchInput').should('be.visible').type('A quiet mystery')
    
    // Check if the search icon is visible and click it
    cy.get('#searchIcon').should('be.visible').click()
    
    // Check if search results section becomes visible
    cy.get('#search-results-section').should('exist')
  })
})
