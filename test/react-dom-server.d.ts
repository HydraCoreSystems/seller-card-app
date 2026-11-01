// The look tests render a few components to HTML with react dom's server renderer.
declare module 'react-dom/server' {
  export function renderToStaticMarkup(element: unknown): string;
}
