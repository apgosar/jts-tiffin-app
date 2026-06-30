const { test, expect } = require('@playwright/test');

test.describe('JTS Delivery Portal End-to-End', () => {
  test('should load the Delivery Portal correctly', async ({ page }) => {
    // Navigate to the delivery portal
    await page.goto('/delivery');
    
    // Verify header title
    await expect(page.locator('text=JTS Delivery Portal')).toBeVisible();

    // Verify it handles loading state
    // Because USE_MOCK_DATA=true returns { success: true, orders: [] } instantly,
    // we should see the "No orders assigned for today" message.
    await expect(page.locator('text=आज के लिए कोई ऑर्डर असाइन नहीं किया गया है।')).toBeVisible();
  });
});
