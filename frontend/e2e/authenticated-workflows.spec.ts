import { expect, test } from '@playwright/test';

test('authenticated navigation uses URLs and exposes redesigned workflows', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('combobox', { name: /Language|Langue/ }).selectOption('fr');
  await page.getByPlaceholder('Utilisateur').fill('demo.school');
  await page.getByPlaceholder('Mot de passe').fill('DemoSchool!12345');
  await page.getByRole('button', { name: 'Connexion' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Central dashboard|Tableau de bord central/)).toBeVisible();

  await page.goto('/compte/sessions');
  await expect(page).toHaveURL(/\/compte\/sessions$/);
  await expect(page.getByText(/Active sessions|Sessions actives/)).toBeVisible();
  await expect(page.getByText(/Current session|Session courante/)).toBeVisible();

  await page.goto('/operations/services');
  await expect(page).toHaveURL(/\/operations\/services$/);
  await expect(page.getByText(/Assignment and entitlements|Attribution et droits/)).toBeVisible();

  await page.getByRole('button', { name: /Logout|Déconnexion/ }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page.getByRole('button', { name: /Login|Connexion/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: /Login|Connexion/ })).toBeVisible();
});

test('language switching is reversible across historical and extracted screens', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('combobox', { name: /Language|Langue/ }).selectOption('fr');
  await page.getByPlaceholder('Utilisateur').fill('demo.school');
  await page.getByPlaceholder('Mot de passe').fill('DemoSchool!12345');
  await page.getByRole('button', { name: 'Connexion' }).click();

  await expect(page.getByText('Tableau de bord central')).toBeVisible();
  await page.getByRole('combobox', { name: /Language|Langue/ }).click();
  await page.getByRole('option', { name: 'EN' }).click();
  await expect(page.getByText('Central dashboard')).toBeVisible();

  await page.goto('/operations/qr');
  await expect(page.getByText('QR generation')).toBeVisible();
  await expect(page.getByText('QR verification')).toBeVisible();

  await page.getByRole('combobox', { name: /Language|Langue/ }).click();
  await page.getByRole('option', { name: 'FR' }).click();
  await expect(page.getByText('Génération QR')).toBeVisible();
  await expect(page.getByText('Vérification QR')).toBeVisible();
});
