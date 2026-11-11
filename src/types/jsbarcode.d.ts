declare module "jsbarcode" {
  interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    margin?: number;
    fontSize?: number;
    background?: string;
    lineColor?: string;
  }
  export default function JsBarcode(element: Element | string, text: string, options?: JsBarcodeOptions): void;
}
