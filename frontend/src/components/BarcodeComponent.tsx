// @ts-nocheck
'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeComponent({ lrn, width = 2, height = 60 }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && lrn) {
      try {
        JsBarcode(barcodeRef.current, lrn, {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: true,
          fontSize: 12,
          margin: 5,
        });
      } catch (err) {
        console.error('Error generating barcode:', err);
      }
    }
  }, [lrn, width, height]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
      <svg ref={barcodeRef}></svg>
    </div>
  );
}

