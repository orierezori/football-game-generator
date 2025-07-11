import { render, screen } from '@testing-library/react'
import MarkdownRenderer from '../MarkdownRenderer'

describe('MarkdownRenderer', () => {
  test('renders markdown with headings', () => {
    const markdown = '# Test Heading\n\nThis is a paragraph.'
    render(<MarkdownRenderer markdown={markdown} />)
    
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent('Test Heading')
  })

  test('renders markdown with lists', () => {
    const markdown = '- First item\n- Second item\n- Third item'
    render(<MarkdownRenderer markdown={markdown} />)
    
    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(3)
    expect(listItems[0]).toHaveTextContent('First item')
    expect(listItems[1]).toHaveTextContent('Second item')
    expect(listItems[2]).toHaveTextContent('Third item')
  })

  test('renders markdown with bold text', () => {
    const markdown = 'This is **bold text** and this is normal.'
    render(<MarkdownRenderer markdown={markdown} />)
    
    const strongElement = screen.getByText('bold text')
    expect(strongElement).toBeInTheDocument()
    expect(strongElement.tagName).toBe('STRONG')
  })

  test('renders links with target="_blank" and rel="noopener noreferrer"', () => {
    const markdown = 'Check out [this link](https://example.com)'
    render(<MarkdownRenderer markdown={markdown} />)
    
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('applies custom className when provided', () => {
    const markdown = 'Test content'
    const { container } = render(<MarkdownRenderer markdown={markdown} className="custom-class" />)
    
    expect(container.firstChild).toHaveClass('custom-class')
  })
}) 