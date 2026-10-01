const { test, expect } = require('@playwright/test');

test.describe('JTS Delivery Portal End-to-End', () => {
  test('should load the Delivery Portal correctly', async ({ page }) => {
    // Navigate to the delivery portal
    await page.goto('/delivery');
    
    // Verify header title
    await expect(page.locator('text=JTS Delivery Portal')).toBeVisible();

    // Verify rider tabs (Sagar and Dabbawala)
    await expect(page.locator('button:has-text("Sagar")')).toBeVisible();
    await expect(page.locator('button:has-text("Dabbawala")')).toBeVisible();

    // Verify it handles empty state
    // Because USE_MOCK_DATA=true returns { success: true, orders: [] } instantly,
    // we should see the "No orders assigned to Sagar for today." message.
    await expect(page.locator('text=/No orders assigned.*for today/')).toBeVisible();
  });
});
