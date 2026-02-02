const { chromium } = require('playwright-core');

(async () => {
  console.log('🚀 Automatizando Netlify deployment...\n');

  try {
    // Conectar al navegador del usuario
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    const context = contexts[0];

    // Crear nueva página o usar existente
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    console.log('✅ Conectado al navegador\n');

    // Paso 1: Ir a Netlify para crear nuevo sitio
    console.log('📝 Navegando a Netlify...');
    await page.goto('https://app.netlify.com/start', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    console.log('✅ Página de Netlify cargada');
    console.log('\n📋 Esperando que selecciones GitHub como provider...');

    // Esperar a que el usuario haga click en GitHub
    await page.waitForURL('**/github.com/**', { timeout: 60000 });
    console.log('✅ GitHub conectado');

    await page.waitForTimeout(2000);

    // Buscar el repositorio
    console.log('\n🔍 Buscando repositorio...');
    const searchBox = await page.locator('input[type="text"], input[type="search"]').first();
    if (searchBox) {
      await searchBox.fill('boda.raquelyadrian.com');
      await page.waitForTimeout(2000);
    }

    console.log('\n✅ Automatización completada!');
    console.log('Por favor completa manualmente:');
    console.log('1. Selecciona el repositorio "boda.raquelyadrian.com"');
    console.log('2. Branch: claude/wedding-website-setup-Hercv');
    console.log('3. Build command: (déjalo vacío)');
    console.log('4. Publish directory: /');
    console.log('5. Click "Deploy site"');

    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Consejo: Asegúrate de que Chrome/Chromium esté abierto con debugging habilitado');
    console.log('Ejecuta: google-chrome --remote-debugging-port=9222');
  }
})();
