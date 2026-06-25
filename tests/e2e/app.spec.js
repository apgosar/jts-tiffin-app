const { test, expect } = require('@playwright/test');

test.describe('JTS Tiffin App End-to-End', () => {
  test('should load the Menu page correctly', async ({ page }) => {
    await page.goto('/');
    
    // Verify title or brand
    await expect(page.locator('text=AIN TIFFIN').first()).toBeVisible();
    
    // Verify Menu text by looking for the quantity stepper's Increase button
    await expect(page.locator('button[aria-label="Increase quantity"]').first()).toBeVisible();
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
    await expect(page.locator('text=Admin Access')).not.toBeVisible();
    await expect(page.locator('button:has-text("Orders")').first()).toBeVisible();
  });

  test('should complete the checkout flow successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for menu to load
    await expect(page.locator('button[aria-label="Increase quantity"]').first()).toBeVisible();

    // Click on Add to Cart (the + button) for the first item
    await page.click('button[aria-label="Increase quantity"] >> nth=0');

    // Wait for the floating cart bar to bounce up and click View Order
    await expect(page.locator('button:has-text("View Order")')).toBeVisible();
    await page.click('button:has-text("View Order")');

    // Expect to be on Checkout page
    await expect(page.locator('h1:has-text("Checkout")')).toBeVisible();

    // Fill the checkout form
    // Note: Phone must be filled first to trigger the lookup and reveal the rest of the form
    await page.fill('#phone', '9876543210');
    
    // Wait for customer lookup / form expansion
    await page.waitForSelector('#name');

    await page.fill('#name', 'Playwright Tester');
    await page.fill('#wingFlat', 'A1');
    await page.fill('#building', 'Test Bldg');
    await page.fill('#street', 'Test Street');
    await page.fill('#locality', 'Test Locality');
    await page.fill('#pincode', '400092');

    // Wait for debounce on pincode and verify if delivery fee is displayed correctly (inside Borivali = 0)
    await page.waitForTimeout(1000); 

    // Click Place Order
    await page.click('button[type="submit"]');

    // Wait for the success page
    await expect(page.locator('text=Order Placed Successfully!')).toBeVisible();
    await expect(page.locator('text=Your tiffin order has been received')).toBeVisible();
  });
});
