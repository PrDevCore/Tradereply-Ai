import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, SAMPLE_TEMPLATE_VALUES, TEMPLATE_VARIABLES } from './templateFill.ts';
import { DEFAULT_TEMPLATES, INITIAL_BUSINESS_PROFILE } from '../mockData.ts';
import type { BusinessProfile } from '../types.ts';

test('fillTemplate substitutes every documented variable', () => {
  const body = TEMPLATE_VARIABLES.map((name) => `{${name}}`).join(' | ');
  const filled = fillTemplate(body, INITIAL_BUSINESS_PROFILE, {
    customerName: 'Sarah',
    service: 'Boiler repair',
    location: 'Guildford',
  });

  assert.equal(filled.includes('{'), false);
  assert.match(filled, /Sarah/);
  assert.match(filled, /Apex Heating & Electrical Solutions/);
  assert.match(filled, /Gas Safe Registered/);
});

test('fillTemplate leaves unknown placeholders visible rather than blanking them', () => {
  const filled = fillTemplate('Hi {customer_name}, re {unknown_thing}.', INITIAL_BUSINESS_PROFILE);
  assert.equal(filled, 'Hi Customer, re {unknown_thing}.');
});

test('fillTemplate falls back to neutral wording when a lead field is empty', () => {
  const filled = fillTemplate('{customer_name}/{service}/{location}', INITIAL_BUSINESS_PROFILE, {
    customerName: '',
    service: '',
    location: '',
  });
  assert.equal(filled, 'Customer/service/your area');
});

test('every shipped template renders with the sample values', () => {
  for (const template of DEFAULT_TEMPLATES) {
    const rendered = fillTemplate(template.body, INITIAL_BUSINESS_PROFILE, SAMPLE_TEMPLATE_VALUES);
    const leftover = rendered.match(/\{[a-z_]+\}/);
    assert.equal(leftover, null, `template "${template.id}" left ${leftover?.[0]} unfilled`);
  }
});

test('a business profile with blank optional fields still renders', () => {
  const blank: BusinessProfile = {
    ...INITIAL_BUSINESS_PROFILE,
    calloutFee: '',
    hourlyRate: '',
    phone: '',
  };
  assert.equal(fillTemplate('{callout_rate}|{hourly_rate}|{phone}', blank), '||');
});
