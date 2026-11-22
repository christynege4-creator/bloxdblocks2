!macro customInstall
  WriteRegStr HKCU "Software\Classes\.bb" "" "BloxdBlocks Block File"
  WriteRegNone HKCU "Software\Classes\.bb\OpenWithProgids" "BloxdBlocks Block File"
  WriteRegStr HKCU "Software\Classes\BloxdBlocks Block File" "" "BloxdBlocks Block File"
  WriteRegStr HKCU "Software\Classes\BloxdBlocks Block File\DefaultIcon" "" `"$INSTDIR\resources\file-logo.ico,0"`
  WriteRegStr HKCU "Software\Classes\BloxdBlocks Block File\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\BloxdBlocks Block File\shell\open\command" "" `"$INSTDIR\BloxdBlocks.exe" "%1"`
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  ReadRegStr $0 HKCU "Software\Classes\.bb" ""
  StrCmp $0 "BloxdBlocks Block File" 0 +2
  DeleteRegValue HKCU "Software\Classes\.bb" ""
  DeleteRegValue HKCU "Software\Classes\.bb\OpenWithProgids" "BloxdBlocks Block File"
  DeleteRegKey HKCU "Software\Classes\BloxdBlocks Block File"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
