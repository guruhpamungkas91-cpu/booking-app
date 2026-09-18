import 'react';

declare module 'react' {
  interface CSSProperties {
    '--theme-primary'?: string;
    '--tw-ring-color'?: string;
  }
}