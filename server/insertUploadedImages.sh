#!/bin/bash

# Script to insert uploaded UI images into database via API
echo "Inserting uploaded UI images via API..."

# Base URL
BASE_URL="http://localhost:5000/api/ui-images"

# Array of uploaded images
declare -a images=(
  '{"imageUrl": "/api/proxy-image/primary/ui-images/hero-banner.jpg", "imageType": "hero", "altText": "Hero banner", "description": "Main hero banner image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/why-choose-us.jpg", "imageType": "feature", "altText": "Why choose N&P", "description": "Why choose us section image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/visa-services-bg.jpg", "imageType": "service", "altText": "Visa services", "description": "Visa services background image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/japanese-training-bg.jpg", "imageType": "service", "altText": "Japanese training", "description": "Japanese training background image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/flight-tickets-bg.jpg", "imageType": "service", "altText": "Flight tickets", "description": "Flight tickets background image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/testimonial-tran-minh-duc.jpg", "imageType": "testimonial", "altText": "Tran Minh Duc", "description": "Testimonial avatar - Tran Minh Duc"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/testimonial-le-thi-mai.jpg", "imageType": "testimonial", "altText": "Le Thi Mai", "description": "Testimonial avatar - Le Thi Mai"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/study-abroad-students.jpg", "imageType": "ui", "altText": "Study abroad students", "description": "Study abroad page - students image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/visa-consultation.jpg", "imageType": "ui", "altText": "Visa consultation", "description": "Visa services page - consultation image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/japanese-classroom.jpg", "imageType": "ui", "altText": "Japanese classroom", "description": "Japanese training page - classroom image"}'
  '{"imageUrl": "/api/proxy-image/primary/ui-images/flight-booking.jpg", "imageType": "ui", "altText": "Flight booking", "description": "Flight tickets page - booking image"}'
)

# Counter for success/failure
success_count=0
total_count=${#images[@]}

# Loop through images and POST to API
for i in "${!images[@]}"; do
  echo "Uploading image $((i+1))/$total_count..."
  
  response=$(curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -d "${images[$i]}" \
    -w "HTTPSTATUS:%{http_code}")
  
  # Extract HTTP status code
  http_code=$(echo $response | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
  response_body=$(echo $response | sed -E 's/HTTPSTATUS:[0-9]*$//')
  
  if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
    echo "✓ Success: Image $((i+1)) uploaded"
    ((success_count++))
  else
    echo "✗ Failed: Image $((i+1)) - HTTP $http_code"
    echo "Response: $response_body"
  fi
done

echo ""
echo "=== Summary ==="
echo "Total images: $total_count"
echo "Successful: $success_count"
echo "Failed: $((total_count - success_count))"