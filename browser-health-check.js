#!/usr/bin/env node

/**
 * Browser Health Check Script
 * Tests if Puppeteer can launch Chrome successfully in the current environment
 */

const puppeteer = require('puppeteer'); // Utiliser puppeteer standard sans extensions

async function healthCheck() {
    console.log('🔍 Starting browser health check...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Production mode:', process.env.ENV === 'production');
    
    let browser = null;
    let page = null;
    
    try {
        // Test basic browser launch
        console.log('\n📦 Testing basic browser launch...');
        
        const launchOptions = {
            headless: 'new', // process.env.ENV === 'production' ? 'new' : false
            timeout: 60000,
            protocolTimeout: 180000, // 3 minutes for protocol operations
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-web-security',
                '--disable-ipc-flooding-protection',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-zygote',
                '--single-process',
                '--disable-background-networking',
                '--disable-client-side-phishing-detection',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-features=TranslateUI',
                '--disable-features=BlinkGenPropertyTrees',
                '--memory-pressure-off',
                // GPU and graphics fixes for containers
                '--disable-gl-extensions',
                '--disable-accelerated-2d-canvas',
                '--disable-accelerated-jpeg-decoding',
                '--disable-accelerated-mjpeg-decode',
                '--disable-accelerated-video-decode',
                '--disable-accelerated-video-encode',
                '--disable-gpu-process-crash-limit',
                '--disable-gpu-rasterization',
                '--disable-partial-raster',
                '--disable-skia-runtime-opts',
                '--disable-threaded-compositing',
                '--disable-threaded-scrolling',
                '--disable-checker-imaging',
                '--disable-image-animation-resync',
                '--use-gl=swiftshader-webgl',
                '--disable-features=UseSkiaRenderer',
                '--in-process-gpu',
                '--disable-gpu-sandbox'
            ]
        };
        
        if (process.env.ENV === 'production') {
            console.log('🐳 Production mode detected, using chromium-browser');
            launchOptions.executablePath = '/usr/bin/chromium-browser';
            launchOptions.dumpio = true;
            launchOptions.pipe = true;
        }
        
        console.log('Launch options:', JSON.stringify(launchOptions, null, 2));
        
        const startTime = Date.now();
        browser = await puppeteer.launch(launchOptions);
        const launchTime = Date.now() - startTime;
        
        console.log(`✅ Browser launched successfully in ${launchTime}ms`);
        
        // Test page creation
        console.log('\n📄 Testing page creation...');
        page = await browser.newPage();
        
        // Set page timeouts
        page.setDefaultTimeout(60000); // 60 seconds for page operations
        page.setDefaultNavigationTimeout(90000); // 90 seconds for navigation
        
        console.log('✅ Page created successfully');
        
        // Test basic navigation
        console.log('\n🌐 Testing navigation...');
        await page.goto('https://httpbin.org/get', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        console.log('✅ Navigation successful');
        
        // Test page content
        const title = await page.title();
        const url = page.url();
        console.log(`📋 Page title: ${title}`);
        console.log(`📋 Page URL: ${url}`);
        
        // Test JavaScript execution
        console.log('\n⚙️ Testing JavaScript execution...');
        const userAgent = await page.evaluate(() => navigator.userAgent);
        console.log(`📋 User Agent: ${userAgent}`);
        
        console.log('\n🎉 All tests passed! Browser is working correctly.');
        
    } catch (error) {
        console.error('\n❌ Health check failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Detailed error analysis
        if (error.message.includes('Timed out after')) {
            console.error('\n🕐 TIMEOUT ERROR DETECTED:');
            console.error('- This indicates Chrome is taking too long to start');
            console.error('- Common causes: insufficient memory, missing dependencies');
            console.error('- Solutions: increase memory, check Chrome installation');
        }
        
        if (error.message.includes('No such file')) {
            console.error('\n📁 FILE NOT FOUND ERROR:');
            console.error('- Chrome executable not found');
            console.error('- Check if chromium-browser is installed');
            console.error('- Verify PUPPETEER_EXECUTABLE_PATH');
        }
        
        process.exit(1);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        if (page) {
            try {
                await page.close();
                console.log('✅ Page closed');
            } catch (e) {
                console.warn('⚠️ Error closing page:', e.message);
            }
        }
        
        if (browser) {
            try {
                await browser.close();
                console.log('✅ Browser closed');
            } catch (e) {
                console.warn('⚠️ Error closing browser:', e.message);
            }
        }
    }
}

// Run health check
if (require.main === module) {
    healthCheck().catch(console.error);
}

module.exports = { healthCheck };
