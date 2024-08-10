#!/bin/bash

pm2 kill
git stash
git pull origin main
pm2 start app.js
pm2 save
