#!/bin/bash

# Add debug logging to the comment route
sed -i '/console.log("========================================");/a \  console.log("🔴🔴🔴 BACKEND: Comment request received at:", new Date().toISOString());\n  console.log("🔴🔴🔴 BACKEND: User ID:", userId);\n  console.log("🔴🔴🔴 BACKEND: Post ID:", id);\n  console.log("🔴🔴🔴 BACKEND: Comment text:", text);' index.js

echo "✅ Debug logs added to backend"
