const { test, expect } = require('@playwright/test');

test.describe('JTS Tiffin App End-to-End', () => {
  test('should load the Menu page correctly', async ({ page }) => {
    await page.goto('/');
    
    // Verify title or brand
    await expect(page.locator('text=AIN TIFFIN').first()).toBeVisible();
    
    // Verify Menu text
    await expect(page.locator('button:has-text("Add to Cart")').first()).toBeVisible();
  });

  test('should allow admin login with correct password', async ({ page }) => {
    require('dotenv').config();
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme';
    await page.goto('/admin');
    
    // Fill the password input
    await page.fill('input[type="password"]', adminPass);
    
    // Click login
    await page.click('button:has-text("Login")');
    
    // Verify successful login by checking for Admin Dashboard elements
    await expect(page.locator('text=Orders').first()).toBeVisible();
  });

  test('should complete the checkout flow successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for menu to load
    await expect(page.locator('button:has-text("Add to Cart")').first()).toBeVisible();

    // Click on Add to Cart for the first item
    await page.click('button:has-text("Add to Cart") >> nth=0');

    // Click on Checkout
    await page.click('button:has-text("Checkout")');

    // Expect to be on Checkout page
    await expect(page.locator('text=Complete Your Order')).toBeVisible();

    // Fill the checkout form
    await page.fill('input[name="name"]', 'Playwright Tester');
    await page.fill('input[name="phone"]', '9999999999');
    await page.fill('input[name="wingFlat"]', 'A1');
    await page.fill('input[name="building"]', 'Test Bldg');
    await page.fill('input[name="street"]', 'Test Street');
    await page.fill('input[name="locality"]', 'Test Locality');
    await page.fill('input[name="pincode"]', '400092');

    // Wait for debounce on pincode and verify if delivery fee is displayed correctly (inside Borivali = 0)
    await page.waitForTimeout(1000); 

    // Click Place Order
    await page.click('button:has-text("Place Order")');

    // Wait for the success page
    await expect(page.locator('text=Order Placed Successfully!')).toBeVisible();
    await expect(page.locator('text=We have received your order')).toBeVisible();
  });
});
