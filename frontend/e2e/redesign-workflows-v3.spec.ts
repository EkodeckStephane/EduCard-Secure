import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function localSecret(name: string) {
  const line = readFileSync(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../.env'), 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() ?? '';
}

function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

async function loginCentral(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('combobox', { name: /Language|Langue/ }).selectOption('fr');
  await page.getByPlaceholder('Utilisateur').fill('demo.central');
  await page.getByPlaceholder('Mot de passe').fill('DemoCentral!12345');
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.getByPlaceholder('Code MFA').fill(totp(localSecret('DEMO_PRIVILEGED_TOTP_SECRET')));
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(page.getByRole('button', { name: 'Compte' })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('student row opens the dedicated tabbed record', async ({ page }) => {
  await loginCentral(page);
  await page.goto('/scolarite/eleves');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.locator('tbody tr').first().click();

  await expect(page).toHaveURL(/\/scolarite\/eleves\/\d+/);
  await expect(page.getByRole('tab', { name: /Synth/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Identit/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Parcours/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Carte/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Services/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Historique/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Doublons/ })).toBeVisible();

  await page.getByRole('tab', { name: /Identit/ }).click();
  await expect(page).toHaveURL(/\?tab=identity$/);
  await expect(page.getByLabel(/Statut/)).toBeVisible();
});

test('specialized dashboards render KPI blocks, charts and an aggregate view', async ({ page }) => {
  await loginCentral(page);
  for (const route of ['cartes', 'presence', 'paiements', 'securite', 'services']) {
    await page.goto(`/dashboard/${route}`);
    await expect(page.getByRole('button', { name: /Tableau de bord central/ })).toBeVisible();
    await expect(page.getByText(/Vue agr/)).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible();
  }
});

test('backup history remains read-only and displays its summary', async ({ page }) => {
  await loginCentral(page);
  await page.goto('/gouvernance/sauvegardes');
  await expect(page.getByText(/Derni.re sauvegarde r/)).toBeVisible();
  await expect(page.getByText(/exclusivement via les scripts PowerShell/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Restaurer|Sauvegarder|V.rifier/ })).toHaveCount(0);
});
