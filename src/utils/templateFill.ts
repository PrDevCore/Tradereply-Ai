import { BusinessProfile } from '../types.ts';

/** Every placeholder a template body may use. */
export const TEMPLATE_VARIABLES = [
  'customer_name',
  'business_name',
  'service',
  'location',
  'earliest_slot',
  'callout_rate',
  'hourly_rate',
  'warranty_years',
  'phone',
  'contact_name',
  'accreditation_badge',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export interface TemplateFillOverrides {
  customerName?: string;
  service?: string;
  location?: string;
}

/** Values the template library uses when previewing a template with no real lead. */
export const SAMPLE_TEMPLATE_VALUES: Required<TemplateFillOverrides> = {
  customerName: 'Sarah',
  service: 'Boiler Diagnostic & Repair',
  location: 'Guildford (GU1)',
};

/**
 * Substitute every known {placeholder} in a template body.
 *
 * One implementation for both the simulator (real lead values) and the template
 * library (sample values) so the two views can no longer drift apart. Unknown
 * placeholders are left untouched and therefore visible: a raw {placeholder} in a
 * draft is an obvious bug report, whereas silently blanking it is not.
 */
export function fillTemplate(
  templateBody: string,
  businessProfile: BusinessProfile,
  overrides: TemplateFillOverrides = {},
): string {
  const values: Record<TemplateVariable, string> = {
    customer_name: overrides.customerName || 'Customer',
    business_name: businessProfile.companyName,
    service: overrides.service || 'service',
    location: overrides.location || 'your area',
    earliest_slot: businessProfile.availableTimeslots,
    callout_rate: businessProfile.calloutFee,
    hourly_rate: businessProfile.hourlyRate,
    warranty_years: businessProfile.guaranteeDetails,
    phone: businessProfile.phone,
    contact_name: businessProfile.contactPerson,
    accreditation_badge: businessProfile.accreditationBadge,
  };

  return templateBody.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    return values[key as TemplateVariable];
  });
}
