import { useState } from "react";
import { Shield, Mail, Phone, MapPin, Edit3, Camera, CheckCircle2, Save, X, ArrowLeft, KeyRound } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { api } from "../services/api";
import { TaskLoader } from "./TaskLoader";


const EditableField = ({ label, value, name, isEditing, onChange, icon: Icon }) => (
  <div className="flex items-center gap-4 group">
    <div className={cn(
      "p-3 rounded-2xl border transition-all",
      isEditing ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600"
    )}>
      <Icon size={20} />
    </div>
    <div className="flex-1">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      {isEditing ? (
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(name, e.target.value)}
          className="premium-input text-sm font-bold text-slate-900 rounded-xl px-3 py-2 mt-1 outline-none w-full"
        />
      ) : (
        <p className="text-sm font-bold text-slate-900">{value}</p>
      )}
    </div>
  </div>
);

export function ProfileView({ user, setUser, onBack }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempUser, setTempUser] = useState({ ...user });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const handleUpdate = (name, value) => {
    setTempUser(prev => ({ ...prev, [name]: name === "phone" ? value.replace(/\D/g, "") : value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempUser(prev => ({ ...prev, avatar: reader.result }));
        if (!isEditing) {
          setUser(prev => ({ ...prev, avatar: reader.result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = () => {
    setUser({ ...tempUser });
    setIsEditing(false);
    toast.success("Profile Updated", { description: "Your changes have been saved to the system." });
  };

  const cancelEdit = () => {
    setTempUser({ ...user });
    setIsEditing(false);
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const savePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Password mismatch", { description: "New password and confirmation must match." });
      return;
    }
    setIsPasswordSaving(true);
    try {
      const { user: updatedUser } = await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setUser(updatedUser);
      setTempUser(updatedUser);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed", { description: "Your account password has been updated." });
    } catch (error) {
      toast.error("Password update failed", { description: error.message });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const keepCurrentPassword = async () => {
    setIsPasswordSaving(true);
    try {
      const { user: updatedUser } = await api.changePassword({ keepCurrent: true });
      setUser(updatedUser);
      setTempUser(updatedUser);
      toast.success("Password kept", { description: "You can still change it later from this profile page." });
    } catch (error) {
      toast.error("Password review failed", { description: error.message });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto motion-page pb-20">
      {/* Sticky Back Button Container */}
      <div className="sticky top-0 z-50 mb-4 pointer-events-none">
        <button 
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-2 p-3 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl text-slate-500 hover:text-slate-900 transition-all group active:scale-95"
        >
          <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">Back to Directory</span>
        </button>
      </div>

      {/* Cover & Avatar Section */}

      <div className="relative mb-24">
        <div className="h-48 w-full premium-dark-panel rounded-[1.6rem] relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
        </div>
        
        <div className="absolute -bottom-16 left-4 right-4 sm:left-12 sm:right-auto flex items-end gap-4 sm:gap-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl bg-white p-1 shadow-2xl overflow-hidden border-4 border-white">
              <img src={isEditing ? tempUser.avatar : user.avatar} alt={user.name} className="w-full h-full object-cover rounded-2xl bg-slate-100" />
            </div>
            <label className="absolute -bottom-2 -right-2 p-2.5 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-indigo-600 transition-all border-2 border-white cursor-pointer flex items-center justify-center group/btn z-20 hover:scale-110 active:scale-95 shadow-indigo-500/20" title="Change Photo">
              <Camera size={18} />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                handleAvatarChange(e);
              }} />
            </label>
          </div>


          
          <div className="mb-4">
            {isEditing ? (
              <input 
                type="text" 
                value={tempUser.name} 
                onChange={(e) => handleUpdate("name", e.target.value)}
                className="premium-input w-full max-w-[18rem] text-2xl sm:text-3xl font-black text-slate-900 tracking-tight rounded-2xl px-4 py-2 outline-none"
              />
            ) : (
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{user.name}</h1>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-full tracking-widest border border-indigo-200">
                {isEditing ? tempUser.designation : user.designation}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={12} />
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className={cn(
          "premium-card rounded-[1.35rem] border p-5 sm:p-6",
          user.requiresPasswordReview ? "border-amber-100 bg-amber-50/70" : "border-slate-100 bg-white/75",
        )}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-inner",
                user.requiresPasswordReview ? "border-amber-100 bg-white text-amber-700" : "border-blue-100 bg-blue-50 text-blue-700",
              )}>
                <KeyRound size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password Access</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {user.requiresPasswordReview ? "Review Your Temporary Password" : "Change Your Password"}
                </h2>
                <p className="mt-1 max-w-xl text-sm font-medium leading-6 text-slate-500">
                  {user.requiresPasswordReview
                    ? "Your account was newly created. You can change the password now or keep the current one."
                    : "Update your password without asking an admin."}
                </p>
              </div>
            </div>
            {user.requiresPasswordReview && (
              <button type="button" onClick={keepCurrentPassword} disabled={isPasswordSaving} className="ui-btn ui-btn-md ui-btn-secondary">
                Keep Current Password
              </button>
            )}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
              placeholder="Current password"
              className="premium-input rounded-2xl px-4 py-3 text-sm outline-none"
            />
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => updatePasswordField("newPassword", event.target.value)}
              placeholder="New password"
              className="premium-input rounded-2xl px-4 py-3 text-sm outline-none"
            />
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
              placeholder="Confirm new password"
              className="premium-input rounded-2xl px-4 py-3 text-sm outline-none"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={savePassword} disabled={isPasswordSaving} className="ui-btn ui-btn-md ui-btn-primary">
              {isPasswordSaving ? <TaskLoader type="profile" compact className="button-inline-loader" /> : <><KeyRound size={17} />Update Password</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col p-6 premium-card premium-card-hover rounded-[1.35rem]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Official Employee ID</span>
            {isEditing ? (
              <input 
                type="text" 
                value={tempUser.workId} 
                onChange={(e) => handleUpdate("workId", e.target.value)}
                className="premium-input text-2xl font-black text-slate-900 font-mono tracking-tight rounded-xl px-3 py-2 outline-none"
              />
            ) : (
              <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">{user.workId}</span>
            )}
          </div>
          <div className="flex flex-col p-6 premium-card premium-card-hover rounded-[1.35rem]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Designation / Role</span>
            <span className="text-2xl font-black text-slate-900">{user.designation}</span>
          </div>

        </div>

        <div className="premium-card p-5 sm:p-8 rounded-[1.6rem] space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Personal Details</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Information used for official auditing</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {isEditing ? (
                <>
                  <button 
                    onClick={cancelEdit}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white rounded-2xl transition-all border border-slate-200"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button 
                    onClick={saveProfile}
                    className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-bold bg-slate-950 hover:bg-blue-700 text-white rounded-2xl transition-all shadow-lg shadow-slate-200 active:scale-95"
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 rounded-2xl transition-all border border-blue-100 bg-white/70"
                >
                  <Edit3 size={16} />
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <EditableField 
              label="Email Address" 
              value={isEditing ? tempUser.email : user.email} 
              name="email"
              isEditing={isEditing}
              onChange={handleUpdate}
              icon={Mail}
            />
            <EditableField 
              label="Phone Number" 
              value={isEditing ? tempUser.phone : user.phone} 
              name="phone"
              isEditing={isEditing}
              onChange={handleUpdate}
              icon={Phone}
            />
            <EditableField 
              label="Base Location" 
              value={isEditing ? tempUser.location : user.location} 
              name="location"
              isEditing={isEditing}
              onChange={handleUpdate}
              icon={MapPin}
            />
            <EditableField 
              label="System Permissions" 
              value={user.role} 
              name="role"
              isEditing={false}
              onChange={() => {}}
              icon={Shield}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
