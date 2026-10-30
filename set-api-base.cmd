@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-api-base.ps1" %*
