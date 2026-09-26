import { BusinessProfile, Lead, Template, ToneSettings } from './types.ts';

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  companyName: 'Apex Heating & Electrical Solutions',
  tradeType: 'Heating, Plumbing & Electrical',
  contactPerson: 'James Carter',
  phone: '07700 900382',
  email: 'enquiries@apexheat-electric.co.uk',
  website: 'www.apexheat-electric.co.uk',
  yearsInBusiness: 14,
  checkatradeRating: 9.94,
  reviewsCount: 186,
  calloutFee: '£75 + VAT (covers 1st hour diagnostics)',
  hourlyRate: '£65/hr',
  travelRadius: '25 miles of Guildford & Surrey',
  guaranteeDetails: '12-month full workmanship guarantee on all repairs and installations',
  availableTimeslots: 'Today 2:30pm - 5:00pm, or tomorrow morning 8:30am - 12:00pm',
  accreditationBadge: 'Gas Safe Registered (#594821) & NICEIC Approved Contractor',
};

export const INITIAL_TONE_SETTINGS: ToneSettings = {
  activeTone: 'professional_polished',
  formalityLevel: 4,
  replyLength: 'standard',
  includeCheckatradeBadge: true,
  includeCallToAction: 'site_visit',
  customRulePrompt: 'Always reassure the customer about our Gas Safe accreditation and 12-month guarantee. Never give a fixed final price for leak tracing without on-site survey.',
  autoSignOff: true,
};

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'emergency_dispatch',
    title: '🚨 Emergency Rapid Response',
    category: 'Emergency & Call-Out',
    description: 'Immediate response for active leaks, boiler shut-downs, or electrical loss of power.',
    body: `Hi {customer_name},

Thank you for contacting {business_name} on Checkatrade regarding your emergency {service} in {location}.

We treat active issues with top priority and have a mobile engineer available {earliest_slot}. Our standard diagnostic call-out fee is {callout_rate}.

Please give me an immediate call on {phone} or confirm your full street address here so I can dispatch our engineer directly to you.

Best regards,
{contact_name}
{business_name}
Checkatrade Verified ({accreditation_badge})`,
    variablesUsed: ['customer_name', 'business_name', 'service', 'location', 'earliest_slot', 'callout_rate', 'phone', 'contact_name', 'accreditation_badge'],
  },
  {
    id: 'site_visit_survey',
    title: '📅 Free Site Survey & Measure-Up',
    category: 'Estimates & Quotes',
    description: 'Invites the customer to book an in-person, no-obligation inspection and measure-up.',
    body: `Hi {customer_name},

Thanks for reaching out about your {service} project in {location}. 

I am {contact_name} from {business_name}. We have completed numerous similar projects across Surrey and Hampshire, and we'd be delighted to help you get this done to the highest standard.

To give you an accurate, fixed-price quote with no surprises, I would be happy to pop round for a free, 15-minute site visit. 

Would any of these slots suit your schedule?
- {earliest_slot}

All our work carries our {warranty_years} guarantee, and you can view our 180+ verified 9.9/10 reviews directly on our Checkatrade profile.

Looking forward to hearing from you,
{contact_name} | {phone}
{business_name}`,
    variablesUsed: ['customer_name', 'service', 'location', 'contact_name', 'business_name', 'earliest_slot', 'warranty_years', 'phone'],
  },
  {
    id: 'photo_request_diagnostic',
    title: '📸 Photo / Video Diagnostic Request',
    category: 'Pre-Visit Triage',
    description: 'Requests photos of the boiler/fusebox/leak so you can quote quickly without a wasted trip.',
    body: `Hi {customer_name},

Thank you for your enquiry regarding {service}.

To give you a clear preliminary estimate and ensure we bring the right replacement parts with us on the first visit, could you share 2-3 photos (or a brief 10-second video) of:
1. The unit/area requiring work
2. The model sticker or serial plate (if accessible)
3. The surrounding pipework or access space

You can reply directly here or send them via WhatsApp to my mobile at {phone}. Once received, I will review and reply within the hour with our recommendations!

Kind regards,
{contact_name}
{business_name}`,
    variablesUsed: ['customer_name', 'service', 'phone', 'contact_name', 'business_name'],
  },
  {
    id: 'transparent_ballpark',
    title: '💷 Transparent Ballpark & Scope',
    category: 'Estimates & Quotes',
    description: 'Provides upfront typical cost ranges and terms for common installations.',
    body: `Hi {customer_name},

Thank you for enquiring on Checkatrade regarding {service}.

For a standard job of this scope in {location}, typical costs usually range around our standard rates:
- Initial diagnostic / 1st hour: {callout_rate}
- Standard labour: {hourly_rate} plus materials at trade cost

We supply full itemised receipts, no hidden fees, and everything is covered by our {warranty_years} guarantee.

If you'd like to proceed or discuss the specifics, please let me know your availability for {earliest_slot} or call {phone}.

Warm regards,
{contact_name}
{business_name}`,
    variablesUsed: ['customer_name', 'service', 'location', 'callout_rate', 'hourly_rate', 'warranty_years', 'earliest_slot', 'phone', 'contact_name', 'business_name'],
  },
  {
    id: 'out_of_hours_reply',
    title: '🌙 Out-of-Hours / Evening Auto-Reply',
    category: 'Availability',
    description: 'Polite instant reply sent during evenings or weekends assuring first-morning follow-up.',
    body: `Hi {customer_name},

Thank you for contacting {business_name} this evening regarding {service}.

Our office is now closed for the day, but I have received your enquiry. If this is an urgent emergency requiring out-of-hours assistance, please call our on-duty mobile directly at {phone}.

Otherwise, I will review your project first thing at 8:00 AM tomorrow and send across available inspection slots for {location}.

Thank you for your patience,
{contact_name}
{business_name}`,
    variablesUsed: ['customer_name', 'business_name', 'service', 'phone', 'location', 'contact_name'],
  },
  {
    id: 'polite_followup',
    title: '👋 Gentle Lead Follow-Up',
    category: 'Follow-Up',
    description: 'Friendly re-engagement for leads who enquired 2-3 days ago but haven’t confirmed yet.',
    body: `Hi {customer_name},

I hope your week is going well! Just following up briefly on your Checkatrade message from a few days ago regarding your {service}.

We are currently finalising our schedule for the upcoming week and have a couple of slots still open in {location}. 

Are you still looking to get this completed? Let me know if you would like me to pop by or if you have any questions I can answer for you.

Best wishes,
{contact_name}
{business_name} | {phone}`,
    variablesUsed: ['customer_name', 'service', 'location', 'contact_name', 'business_name', 'phone'],
  },
];

// These are DEMO records for previewing the extension UI. They are deliberately
// NOT realistic customer records: the names are invented, the contact details are
// obviously non-routable placeholders, and every record is marked as a sample.
// A viewer must never mistake a seeded row for a genuine enquiry — a tradesperson
// could otherwise think real customer data had been loaded into their browser.
export const INITIAL_LEADS: Lead[] = [
  {
    id: 'sample_lead_01',
    customerName: 'Sample Customer (demo)',
    platform: 'Checkatrade',
    phone: '07700 900001',
    email: 'demo1@example.com',
    location: 'Exampleville',
    postcode: 'AA1 1AA',
    tradeCategory: 'Plumbing & Heating',
    jobTitle: 'DEMO: dripping tap, no hot water',
    messageText: `[DEMO LEAD — not a real customer] Hi, our boiler has stopped working and the kitchen tap is dripping. We have no heating or hot water. Could someone come out and take a look?`,
    receivedAt: '6 minutes ago (demo)',
    urgency: 'Emergency (Immediate)',
    status: 'new',
    photos: [],
    budgetStated: 'Quote required',
  },
  {
    id: 'sample_lead_02',
    customerName: 'Sample Customer 2 (demo)',
    platform: 'Checkatrade',
    phone: '07700 900002',
    email: 'demo2@example.com',
    location: 'Exampleton',
    postcode: 'BB2 2BB',
    tradeCategory: 'Electrical',
    jobTitle: 'DEMO: old fuse box needs replacing',
    messageText: `[DEMO LEAD — not a real customer] Hello, we have an old rewireable fuse box and would like it replaced with a modern consumer unit, plus a safety certificate. What would that cost and when could you inspect?`,
    receivedAt: '2 hours ago (demo)',
    urgency: 'Urgent (24-48h)',
    status: 'analyzed',
    budgetStated: 'Quote required',
  },
];
