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

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead_chk_01',
    customerName: 'Sarah Jenkins',
    platform: 'Checkatrade',
    phone: '07911 234567',
    email: 'sarah.j.surrey@gmail.com',
    location: 'Guildford',
    postcode: 'GU1 4RN',
    tradeCategory: 'Plumbing & Heating',
    jobTitle: 'Worcester Bosch Combi Boiler dropping pressure and leaking water',
    messageText: `Hi there, our Worcester Greenstar combi boiler has dropped pressure to zero and has started dripping water from the underneath onto the kitchen counter. We have no heating or hot water at the moment and we have two small children in the house. Could someone please come out as soon as possible today to diagnose and fix it? What is your call out charge? Thanks, Sarah.`,
    receivedAt: '6 minutes ago',
    urgency: 'Emergency (Immediate)',
    status: 'new',
    photos: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=400&q=80',
    ],
    budgetStated: 'Immediate repair quote needed',
  },
  {
    id: 'lead_chk_02',
    customerName: 'Mark Henderson',
    platform: 'Checkatrade',
    phone: '07823 445566',
    email: 'm.henderson_richmond@outlook.com',
    location: 'Richmond',
    postcode: 'TW9 2DZ',
    tradeCategory: 'Electrical',
    jobTitle: 'Old fuse box upgrade to dual RCD metal consumer unit with EICR',
    messageText: `Good morning. We have just bought a 1970s semi-detached house and the surveyor flagged that the electrical consumer unit still has rewireable cartridge fuses. We are looking to replace this with a modern metal surge-protected consumer unit and need a full Electrical Installation Condition Report (EICR) before plastering begins next month. Can you provide a ballpark estimate and your earliest availability to inspect?`,
    receivedAt: '34 minutes ago',
    urgency: 'Urgent (24-48h)',
    status: 'new',
    budgetStated: '£800 - £1,200',
  },
  {
    id: 'lead_chk_03',
    customerName: 'David & Claire Patel',
    platform: 'Checkatrade',
    phone: '07788 123987',
    email: 'patelfamily.bristol@yahoo.co.uk',
    location: 'Woking',
    postcode: 'GU21 3PQ',
    tradeCategory: 'Roofing & Gutters',
    jobTitle: 'Roof valley leak into bedroom ceiling during heavy rain',
    messageText: `Hello. Following the heavy rain over the weekend, we noticed a damp patch spreading on our master bedroom ceiling right beneath the roof valley. A couple of slate tiles also look slipped or cracked when viewing from the garden. We need someone reliable to get up there, inspect the lead valley and tiles, and quote for remedial repair before further water damage occurs. Are you free for a survey this Thursday?`,
    receivedAt: '2 hours ago',
    urgency: 'Urgent (24-48h)',
    status: 'analyzed',
    budgetStated: 'Quote required after survey',
  },
  {
    id: 'lead_chk_04',
    customerName: 'Oliver Smith',
    platform: 'Checkatrade',
    phone: '07540 987654',
    email: 'oliver.smith.designer@gmail.com',
    location: 'Cobham',
    postcode: 'KT11 1AA',
    tradeCategory: 'Tiling & Bathrooms',
    jobTitle: 'Full family bathroom renovation - walk-in shower & porcelain tiles',
    messageText: `Hi James, I saw your stellar Checkatrade reviews for bathroom refits. We want to strip our existing 2.4m x 2.2m family bathroom and install a concealed thermostatic shower, wall-hung vanity unit, and large format porcelain tiles. We will supply the sanitaryware and tiles ourselves. Could you provide a quotation for labour and first-fix plumbing/electrical materials? We are looking to start late next month.`,
    receivedAt: '5 hours ago',
    urgency: 'Flexible / Planning',
    status: 'new',
    budgetStated: '£3,000 - £4,500 labour',
  },
  {
    id: 'lead_chk_05',
    customerName: 'Emma Watson',
    platform: 'Checkatrade',
    phone: '07999 555123',
    email: 'emma.w.surrey@icloud.com',
    location: 'Weybridge',
    postcode: 'KT13 8DE',
    tradeCategory: 'Electrical',
    jobTitle: '7kW Home EV Charger installation (Zappi / Ohme) on driveway',
    messageText: `Hi! We are taking delivery of our new electric vehicle in three weeks and need a dedicated 7kW EV smart charger installed on our driveway exterior wall. The main fuse board is about 8 metres away in the hallway under the stairs. Could you let me know if you can handle this, what the typical installation fee is, and if you help with OZEV/DNO notification paperwork?`,
    receivedAt: '1 day ago',
    urgency: 'Flexible / Planning',
    status: 'replied',
    budgetStated: '£650 - £950',
    responseHistory: [
      {
        sender: 'tradesperson',
        text: `Hi Emma, thanks for reaching out! Yes, we are OZEV certified and NICEIC approved installers for both Myenergi Zappi and Ohme chargers. We handle full DNO notification for you. Standard installation including dedicated RCBO cable run is typically £650-£750 + VAT. I can pop over this Wednesday to check your main fuse rating and cable path. Does 10am work? Best regards, James.`,
        timestamp: 'Yesterday at 3:15 PM',
      },
    ],
  },
];
