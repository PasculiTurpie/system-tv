import { test, expect } from '@playwright/test';

test('create node and trigger autosave indicator', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo canal' }).click();
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await page.getByRole('button', { name: 'Router' }).click();
  await expect(page.getByText('Guardando...')).toBeVisible();
});
