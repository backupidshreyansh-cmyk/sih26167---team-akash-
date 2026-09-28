#!/bin/bash
echo "=== AUDITING REPOSITORY ==="
npm run lint || exit 1
npm run test || exit 1
npm run build || exit 1
echo "=== BUILD AND TESTS PASSED ==="
