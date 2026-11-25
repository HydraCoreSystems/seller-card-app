Pod::Spec.new do |s|
  s.name           = 'SkrybixOcr'
  s.version        = '1.0.0'
  s.summary        = 'On device text reading for Skrybix claim screenshots.'
  s.description    = 'Reads text and where it sits from a picture, on the device, with Apple Vision.'
  s.license        = 'MIT'
  s.author         = 'Gathering Moss'
  s.homepage       = 'https://gatheringmoss.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://example.invalid/skrybix-ocr' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
