import React, { useState } from 'react';
import { BusinessProfile } from '../types.ts';
import {
  Building2,
  ShieldCheck,
  Check,
  Phone,
  Mail,
  Globe,
  MapPin,
  PoundSterling,
  Award,
  Calendar,
  Save,
} from 'lucide-react';

interface BusinessProfileViewProps {
  businessProfile: BusinessProfile;
  setBusinessProfile: React.Dispatch<React.SetStateAction<BusinessProfile>>;
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  businessProfile,
  setBusinessProfile,
}) => {
  const [profile, setProfile] = useState<BusinessProfile>(businessProfile);
  const [savedAlert, setSavedAlert] = useState<boolean>(false);

  const handleSave = () => {
    setBusinessProfile(profile);
    localStorage.setItem('tradereply_business_profile', JSON.stringify(profile));
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-400" />
            <span>Tradesperson Business Profile</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            These credentials and pricing details are automatically inserted into your auto-replies
            and templates to build instant trust with homeowners.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-md transition"
        >
          {savedAlert ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Profile Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Business Profile</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        {/* Core Company Identity */}
        <div>
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Company Identity & Contact Info</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Company Trading Name</label>
              <input
                type="text"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Contact Person / Engineer Name</label>
              <input
                type="text"
                value={profile.contactPerson}
                onChange={(e) => setProfile({ ...profile, contactPerson: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Primary Trade Category</label>
              <input
                type="text"
                value={profile.tradeType}
                onChange={(e) => setProfile({ ...profile, tradeType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Mobile / Direct Phone Number</label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Business Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Years Established / In Business</label>
              <input
                type="number"
                value={profile.yearsInBusiness}
                onChange={(e) => setProfile({ ...profile, yearsInBusiness: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Checkatrade & Accreditations */}
        <div className="pt-6 border-t border-slate-800">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Checkatrade Metrics & Accreditations</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Checkatrade Score (out of 10)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={profile.checkatradeRating}
                onChange={(e) => setProfile({ ...profile, checkatradeRating: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Verified Review Count</label>
              <input
                type="number"
                value={profile.reviewsCount}
                onChange={(e) => setProfile({ ...profile, reviewsCount: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Coverage / Travel Radius</label>
              <input
                type="text"
                value={profile.travelRadius}
                onChange={(e) => setProfile({ ...profile, travelRadius: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block font-semibold text-slate-300 mb-1">
                Accreditations (Gas Safe, NICEIC, FMB, City & Guilds)
              </label>
              <input
                type="text"
                value={profile.accreditationBadge}
                onChange={(e) => setProfile({ ...profile, accreditationBadge: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Pricing & Guarantees */}
        <div className="pt-6 border-t border-slate-800">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <PoundSterling className="w-4 h-4 text-emerald-400" />
            <span>Standard Rates & Guarantees</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Standard Diagnostic / Call-Out Fee</label>
              <input
                type="text"
                value={profile.calloutFee}
                onChange={(e) => setProfile({ ...profile, calloutFee: e.target.value })}
                placeholder="e.g. £75 + VAT (covers 1st hour)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Hourly Labour Rate</label>
              <input
                type="text"
                value={profile.hourlyRate}
                onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value })}
                placeholder="e.g. £65/hour"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Workmanship Guarantee Details</label>
              <input
                type="text"
                value={profile.guaranteeDetails}
                onChange={(e) => setProfile({ ...profile, guaranteeDetails: e.target.value })}
                placeholder="e.g. 12-month full workmanship guarantee on all repairs and installations"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Default Earliest Available Slots</label>
              <input
                type="text"
                value={profile.availableTimeslots}
                onChange={(e) => setProfile({ ...profile, availableTimeslots: e.target.value })}
                placeholder="e.g. Tomorrow morning 8:30am - 12:00pm, or Thursday 2:00pm"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
