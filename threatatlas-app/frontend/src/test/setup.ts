import '@testing-library/jest-dom'

// Radix UI components (DropdownMenu, Tooltip, Popover) use ResizeObserver
// and Element.scrollIntoView, which jsdom doesn't implement.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Radix UI DropdownMenu uses Element.scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Radix UI uses DOMRect for positioning
if (!global.DOMRect) {
  global.DOMRect = {
    fromRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
  } as unknown as typeof DOMRect
}
