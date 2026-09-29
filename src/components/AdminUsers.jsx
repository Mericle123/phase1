import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundPen,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import { TaskLoader } from "./TaskLoader";

const roles = [
  { value: "employee", label: "Employee" },
  { value: "verifier", label: "Verifier" },
  { value: "admin", label: "Admin" },
];

const displayRoles = [
  ...roles,
  { value: "super_admin", label: "Super Admin" },
];

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "employee",
  designation: "",
  phone: "",
  location: "Thimphu, Bhutan",
  workId: "",
  avatar: "",
};

const maxAdmins = 5;
const usersPerPage = 20;
const emptyFilters = {
  query: "",
  role: "all",
  status: "all",
};
const textInputClass = "premium-input w-full rounded-2xl px-3 py-2 text-xs font-bold text-slate-900 outline-none";
const roleLabelFor = (role) => displayRoles.find((item) => item.value === role)?.label || role;
const isAdminLevel = (user) => ["admin", "super_admin"].includes(user?.role);

const roleDescriptions = {
  employee: "Can enter invoice and client records.",
  verifier: "Can review journals, verify payments, and message employees.",
  admin: "Can manage staff and review records.",
  super_admin: "Owner-level admin assignment access.",
};

const ProfilePhotoPicker = ({ id, name, avatar, onUpload, onRemove }) => (
  <div className="rounded-[1.35rem] border border-slate-100 bg-white/70 p-4">
    <div className="flex items-center gap-4">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-50 shadow-inner">
        {avatar ? (
          <img src={avatar} alt={`${name || "Staff"} profile preview`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Image size={28} />
            <span className="text-[9px] font-black uppercase tracking-widest">Photo</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-900">{avatar ? "Profile photo selected" : "Add profile photo"}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">PNG, JPG, or JPEG. Square photos look best.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input id={id} type="file" accept="image/png,image/jpeg" onChange={onUpload} className="sr-only" />
          <label htmlFor={id} className="ui-btn ui-btn-sm ui-btn-secondary cursor-pointer">
            <Upload size={14} />
            {avatar ? "Replace" : "Upload"}
          </label>
          {avatar && (
            <button type="button" onClick={onRemove} className="ui-btn ui-btn-sm ui-btn-danger">
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);

const RolePicker = ({ id, value, options, disabled, onChange, openRolePicker, setOpenRolePicker }) => {
  const isOpen = openRolePicker === id && !disabled;
  const selectedRole = roleLabelFor(value);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpenRolePicker(isOpen ? "" : id)}
        className={cn(
          "premium-input flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-xs font-black text-slate-900 outline-none transition-all",
          isOpen && "border-blue-400 ring-4 ring-blue-500/10",
          disabled && "cursor-not-allowed opacity-80",
        )}
      >
        <span className="truncate">{selectedRole}</span>
        <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[210]" onClick={() => setOpenRolePicker("")} />
          <div className="absolute left-0 right-0 top-full z-[220] mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
            {options.map((role) => {
              const selected = value === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => {
                    onChange(role.value);
                    setOpenRolePicker("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all",
                    selected ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-blue-50 hover:text-slate-950",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-black">{role.label}</span>
                    <span className={cn("mt-0.5 block text-[10px] font-bold", selected ? "text-white/70" : "text-slate-400")}>
                      {roleDescriptions[role.value]}
                    </span>
                  </span>
                  {selected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export function AdminUsers({ currentUser }) {
  const createFormRef = useRef(null);
  const firstNameRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editing, setEditing] = useState({});
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [openRolePicker, setOpenRolePicker] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [filterDraft, setFilterDraft] = useState(emptyFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const canAssignAdmins = currentUser?.role === "super_admin";

  const activeAdminCount = useMemo(
    () => users.filter((item) => item.role === "admin" && item.active !== false).length,
    [users],
  );
  const adminUsers = useMemo(
    () => users.filter(isAdminLevel).sort((a, b) => Number(b.role === "super_admin") - Number(a.role === "super_admin")),
    [users],
  );
  const createRoleOptions = useMemo(
    () => roles.filter((role) => role.value !== "admin" || canAssignAdmins),
    [canAssignAdmins],
  );
  const filteredUsers = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query || [
        user.name,
        user.email,
        user.workId,
        user.designation,
        user.phone,
        user.location,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesRole = filters.role === "all" || user.role === filters.role;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" ? user.active !== false : user.active === false);
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [filters, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const startIndex = (effectivePage - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [effectivePage, filteredUsers]);
  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => value !== emptyFilters[key]).length,
    [filters],
  );
  const pageStart = filteredUsers.length ? (effectivePage - 1) * usersPerPage + 1 : 0;
  const pageEnd = Math.min(effectivePage * usersPerPage, filteredUsers.length);

  const roleOptionsFor = (user, draftRole) => {
    if (user.role === "super_admin" || draftRole === "super_admin") {
      return displayRoles;
    }
    return roles.filter((role) => role.value !== "admin" || canAssignAdmins || user.role === "admin");
  };

  const canEditAccount = (user) => canAssignAdmins || !isAdminLevel(user);
  const canToggleAccount = (user) => user.id !== currentUser?.id && (canAssignAdmins || !isAdminLevel(user));
  const canDeleteAccount = (user) => user.id !== currentUser?.id && (canAssignAdmins || !isAdminLevel(user));

  const jumpToCreateForm = () => {
    setShowCreatePage(true);
    window.setTimeout(() => {
      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      firstNameRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    let mounted = true;
    api
      .users()
      .then((payload) => {
        if (mounted) setUsers(payload.users);
      })
      .catch((error) => {
        if (mounted) toast.error("Could not load users", { description: error.message });
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const applyFilters = () => {
    setFilters(filterDraft);
    setCurrentPage(1);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setFilterDraft(emptyFilters);
    setFilters(emptyFilters);
    setCurrentPage(1);
  };

  const updateCreateField = (field, value) => {
    setCreateForm((current) => ({ ...current, [field]: field === "phone" ? value.replace(/\D/g, "") : value }));
  };

  const updateEditField = (userId, field, value) => {
    setEditing((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: field === "phone" ? value.replace(/\D/g, "") : value,
      },
    }));
  };

  const startEdit = (user) => {
    setEditing({
      [user.id]: {
        name: user.name || "",
        email: user.email || "",
        role: user.role || "employee",
        designation: user.designation || "",
        phone: user.phone || "",
        location: user.location || "",
        workId: user.workId || "",
        password: "",
        avatar: user.avatar || "",
      },
    });
  };

  const cancelEdit = (userId) => {
    setEditing((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
  };

  const createAccount = async (event) => {
    event.preventDefault();
    if (createForm.role === "admin" && !canAssignAdmins) {
      toast.error("Super Admin Required", { description: "Only the Super Admin can assign Admin access." });
      return;
    }
    if (createForm.role === "admin" && activeAdminCount >= maxAdmins) {
      toast.error("Admin Limit Reached", { description: "Only 5 active admin accounts are allowed." });
      return;
    }
    setIsCreating(true);
    try {
      const { user } = await api.createUser(createForm);
      setUsers((current) => [...current, user]);
      setCreateForm(emptyForm);
      setShowCreatePage(false);
      toast.success("Account created", { description: `${user.name} can now sign in as ${roleLabelFor(user.role)}.` });
    } catch (error) {
      toast.error("Account creation failed", { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePhotoUpload = (event, onImageReady) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Unsupported Image", { description: "Please upload a PNG, JPG, or JPEG image." });
      event.target.value = "";
      return;
    }
    if (file.size > 900 * 1024) {
      toast.error("Image Too Large", { description: "Please choose an image under 900 KB." });
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onImageReady(String(reader.result || ""));
      toast.success("Profile photo added");
    };
    reader.onerror = () => toast.error("Image Upload Failed", { description: "Could not read the selected image." });
    reader.readAsDataURL(file);
  };

  const saveEdit = async (userId) => {
    const draft = editing[userId];
    if (!draft) return;
    const currentUserRecord = users.find((item) => item.id === userId);
    const becomingActiveAdmin =
      draft.role === "admin" &&
      (!isAdminLevel(currentUserRecord) || currentUserRecord?.active === false);

    if ((isAdminLevel(currentUserRecord) || becomingActiveAdmin) && !canAssignAdmins) {
      toast.error("Super Admin Required", { description: "Only the Super Admin can assign or manage Admin access." });
      return;
    }

    if (currentUserRecord?.role === "super_admin" && draft.role !== "super_admin") {
      toast.error("Transfer Required", { description: "Super Admin access must be transferred in a controlled handover." });
      return;
    }

    if (becomingActiveAdmin && activeAdminCount >= maxAdmins) {
      toast.error("Admin Limit Reached", { description: "Only 5 active admin accounts are allowed." });
      return;
    }

    try {
      const payload = { ...draft };
      if (!payload.password) delete payload.password;
      if (payload.role === currentUserRecord?.role) delete payload.role;
      const { user } = await api.updateUser(userId, payload);
      setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));
      cancelEdit(userId);
      toast.success("Account updated", { description: `${user.name}'s details were saved.` });
    } catch (error) {
      toast.error("Update failed", { description: error.message });
    }
  };

  const updateActive = async (userId, active) => {
    const target = users.find((item) => item.id === userId);
    if (!canToggleAccount(target)) {
      toast.error("Action Restricted", { description: "Only the Super Admin can activate or deactivate Admin accounts." });
      return;
    }
    try {
      const { user } = await api.updateUser(userId, { active });
      setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));
      toast.success(active ? "Account activated" : "Account deactivated");
    } catch (error) {
      toast.error("Account update failed", { description: error.message });
    }
  };

  const deleteAccount = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error("Cannot delete current account", { description: "Sign in with another admin account before deleting this one." });
      return;
    }
    if (!canDeleteAccount(user)) {
      toast.error("Action Restricted", { description: "Only the Super Admin can delete Admin accounts." });
      return;
    }
    const confirmed = window.confirm(`Delete ${user.name}'s account? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await api.deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      cancelEdit(user.id);
      toast.success("Account deleted", { description: `${user.name}'s access has been removed.` });
    } catch (error) {
      toast.error("Delete failed", { description: error.message });
    }
  };

  const editingUserId = Object.keys(editing)[0] || "";
  const editingUser = users.find((item) => item.id === editingUserId);
  const editDraft = editingUserId ? editing[editingUserId] : null;
  const editRoleIsLocked =
    editingUser?.role === "super_admin" || (editingUser && isAdminLevel(editingUser) && !canAssignAdmins);

  const editModal = editDraft && editingUser ? createPortal(
    <div className="ui-modal-backdrop" role="presentation" onClick={() => cancelEdit(editingUserId)}>
      <section
        className="ui-modal-panel max-w-4xl motion-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal-header flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-950 px-5 py-5 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <UserRoundPen size={19} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Edit Account</p>
              <h2 id="edit-account-title" className="mt-1 text-xl font-black">{editDraft.name || editingUser.name}</h2>
            </div>
          </div>
          <button type="button" onClick={() => cancelEdit(editingUserId)} className="ui-icon-btn border-white/10 bg-white/10 text-white hover:bg-white/20" aria-label="Close edit account">
            <X size={16} />
          </button>
        </div>

        <div className="ui-modal-body custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr]">
            <div className="border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <ProfilePhotoPicker
                id={`modal-avatar-upload-${editingUserId}`}
                name={editDraft.name}
                avatar={editDraft.avatar}
                onUpload={(event) => handlePhotoUpload(event, (avatar) => updateEditField(editingUserId, "avatar", avatar))}
                onRemove={() => updateEditField(editingUserId, "avatar", "")}
              />
              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Access Level</p>
                <p className="mt-2 text-sm font-black text-blue-950">{roleLabelFor(editDraft.role)}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">{roleDescriptions[editDraft.role]}</p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</span>
                  <input className={`${textInputClass} mt-2 py-3`} value={editDraft.name} onChange={(e) => updateEditField(editingUserId, "name", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</span>
                  <input className={`${textInputClass} mt-2 py-3`} type="email" value={editDraft.email} onChange={(e) => updateEditField(editingUserId, "email", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</span>
                  <div className="mt-2">
                    <RolePicker
                      id={`modal-role-${editingUserId}`}
                      value={editDraft.role}
                      options={roleOptionsFor(editingUser, editDraft.role)}
                      onChange={(value) => updateEditField(editingUserId, "role", value)}
                      disabled={editRoleIsLocked}
                      openRolePicker={openRolePicker}
                      setOpenRolePicker={setOpenRolePicker}
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Designation</span>
                  <input className={`${textInputClass} mt-2 py-3`} value={editDraft.designation} onChange={(e) => updateEditField(editingUserId, "designation", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</span>
                  <input className={`${textInputClass} mt-2 py-3`} value={editDraft.phone} onChange={(e) => updateEditField(editingUserId, "phone", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</span>
                  <input className={`${textInputClass} mt-2 py-3`} value={editDraft.location} onChange={(e) => updateEditField(editingUserId, "location", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Work ID</span>
                  <input className={`${textInputClass} mt-2 py-3`} value={editDraft.workId} onChange={(e) => updateEditField(editingUserId, "workId", e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Password</span>
                  <input className={`${textInputClass} mt-2 py-3`} type="password" value={editDraft.password} onChange={(e) => updateEditField(editingUserId, "password", e.target.value)} placeholder="Leave blank to keep current password" />
                </label>
              </div>

            </div>
          </div>
        </div>
        <div className="ui-modal-footer border-t border-slate-200/70 bg-white/90 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => cancelEdit(editingUserId)} className="ui-btn ui-btn-md ui-btn-secondary">
              <X size={18} />
              Cancel
            </button>
            <button type="button" onClick={() => saveEdit(editingUserId)} className="ui-btn ui-btn-md ui-btn-primary">
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="ct-page p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-8 motion-page pb-20">
      {!showCreatePage && (
      <>
      <div className="ct-section-hero flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="ct-eyebrow">
            <UsersRound size={14} />
            Admin Control
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-white">User Management</h1>
          <p className="text-white/64 mt-2 max-w-2xl">
            Create, update, deactivate, and delete Employee accounts. Only the Super Admin can assign Admin access.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="admin-seat-count rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white">
            Admin seats: {activeAdminCount}/{maxAdmins}
          </div>
          <button type="button" onClick={jumpToCreateForm} className="ui-btn ui-btn-md ct-hero-action">
            <Plus size={18} />
            Add Account
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="premium-card rounded-[1.35rem] p-5 lg:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin Assignment</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">{canAssignAdmins ? "Super Admin Mode" : "Staff Admin Mode"}</h2>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            {canAssignAdmins
              ? "You can promote staff to Admin until the five-seat limit is reached."
              : "You can manage Employee accounts. Admin promotions are reserved for the Super Admin."}
          </p>
        </div>
        <div className="premium-card rounded-[1.35rem] p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Admins</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Admin Seat Register</h2>
            </div>
            <span className="ui-status-badge bg-blue-50 text-blue-700 border-blue-100">{activeAdminCount}/{maxAdmins} active</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {adminUsers.map((admin) => (
              <div key={admin.id} className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 overflow-hidden rounded-2xl border border-white bg-slate-100 shadow-sm">
                    <img src={admin.avatar} alt={admin.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{admin.name}</p>
                    <p className="truncate text-[10px] font-bold text-slate-400">{admin.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={cn(
                    "ui-status-badge",
                    admin.role === "super_admin" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-blue-50 text-blue-700 border-blue-100",
                  )}>
                    {roleLabelFor(admin.role)}
                  </span>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    admin.active ? "text-emerald-600" : "text-rose-600",
                  )}>
                    {admin.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
            {adminUsers.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 text-sm font-bold text-slate-500">
                No admin accounts found.
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {showCreatePage && (
      <form ref={createFormRef} onSubmit={createAccount} className="scroll-mt-8 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
        <div className="border-b border-slate-100 bg-slate-950 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <Camera size={18} />
              </div>
              <div>
                <h2 className="text-lg font-black">Add Account Form</h2>
                <p className="text-xs font-medium text-white/60">Create one complete staff profile in a single place.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowCreatePage(false)} className="ui-btn ui-btn-sm ui-btn-secondary border-white/10 bg-white/10 text-white hover:bg-white/20">
                <X size={14} />
                Back
              </button>
              <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {roleLabelFor(createForm.role)}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[22rem_1fr]">
          <div className="border-b border-slate-100 bg-slate-50/80 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <ProfilePhotoPicker
              id="create-avatar-upload"
              name={createForm.name}
              avatar={createForm.avatar}
              onUpload={(event) => handlePhotoUpload(event, (avatar) => updateCreateField("avatar", avatar))}
              onRemove={() => updateCreateField("avatar", "")}
            />
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-semibold leading-5 text-blue-800">
              Staff photos appear in User Management, the header profile, and activity records where available.
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</span>
                <input ref={firstNameRef} className={`${textInputClass} mt-2 py-3`} value={createForm.name} onChange={(e) => updateCreateField("name", e.target.value)} placeholder="Full name" required />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</span>
                <input className={`${textInputClass} mt-2 py-3`} type="email" value={createForm.email} onChange={(e) => updateCreateField("email", e.target.value)} placeholder="Email address" required />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Password</span>
                <input className={`${textInputClass} mt-2 py-3`} type="password" value={createForm.password} onChange={(e) => updateCreateField("password", e.target.value)} placeholder="Temporary password" required />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</span>
                <div className="mt-2">
                  <RolePicker
                    id="create-role"
                    value={createForm.role}
                    options={createRoleOptions}
                    onChange={(value) => updateCreateField("role", value)}
                    openRolePicker={openRolePicker}
                    setOpenRolePicker={setOpenRolePicker}
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Designation</span>
                <input className={`${textInputClass} mt-2 py-3`} value={createForm.designation} onChange={(e) => updateCreateField("designation", e.target.value)} placeholder="Designation" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</span>
                <input className={`${textInputClass} mt-2 py-3`} value={createForm.phone} onChange={(e) => updateCreateField("phone", e.target.value)} placeholder="Phone" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</span>
                <input className={`${textInputClass} mt-2 py-3`} value={createForm.location} onChange={(e) => updateCreateField("location", e.target.value)} placeholder="Location" />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Work ID</span>
                <input className={`${textInputClass} mt-2 py-3`} value={createForm.workId} onChange={(e) => updateCreateField("workId", e.target.value)} placeholder="Generated if left blank" />
              </label>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={() => setCreateForm(emptyForm)} className="ui-btn ui-btn-md ui-btn-secondary">
                <X size={18} />
                Clear Form
              </button>
              <button type="submit" disabled={isCreating} className="ui-btn ui-btn-md ui-btn-primary">
                {isCreating ? <TaskLoader type="user" compact className="button-inline-loader" /> : <><Plus size={18} />Create Account</>}
              </button>
            </div>
          </div>
        </div>
      </form>
      )}

      {!showCreatePage && (
      <div className="premium-card rounded-[1.35rem] overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-900">Application Users</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Showing {pageStart}-{pageEnd} of {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterDraft(filters);
                setShowFilters((current) => !current);
              }}
              className={cn("ui-btn ui-btn-sm ui-btn-secondary", showFilters && "border-blue-200 bg-blue-50 text-blue-800")}
              aria-expanded={showFilters}
              aria-controls="user-management-filters"
            >
              <Filter size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-900 px-1.5 text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div id="user-management-filters" className="motion-menu grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto] lg:items-end">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Search users</span>
                <span className="relative mt-2 block">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={filterDraft.query}
                    onChange={(event) => setFilterDraft((current) => ({ ...current, query: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyFilters();
                      }
                    }}
                    className="premium-input w-full rounded-lg py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none"
                    placeholder="Name, email, work ID, contact..."
                  />
                </span>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Role</span>
                <select
                  value={filterDraft.role}
                  onChange={(event) => setFilterDraft((current) => ({ ...current, role: event.target.value }))}
                  className="premium-input mt-2 w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none"
                >
                  <option value="all">All roles</option>
                  {displayRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                <select
                  value={filterDraft.status}
                  onChange={(event) => setFilterDraft((current) => ({ ...current, status: event.target.value }))}
                  className="premium-input mt-2 w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" onClick={resetFilters} className="ui-btn ui-btn-sm ui-btn-secondary">
                  <RotateCcw size={14} />
                  Reset
                </button>
                <button type="button" onClick={applyFilters} className="ui-btn ui-btn-sm ui-btn-primary">
                  <Check size={14} />
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="ui-table-scroll custom-scrollbar">
          <table className="ui-table ledger-table">
            <thead>
              <tr>
                <th className="w-[22%]">User</th>
                <th className="w-[13%]">Work ID</th>
                <th className="w-[14%]">Role</th>
                <th className="w-[15%]">Designation</th>
                <th className="w-[14%]">Contact</th>
                <th className="w-[10%]">Status</th>
                <th className="ui-action-cell">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedUsers.map((item) => {
                const rowCanEdit = canEditAccount(item);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl overflow-hidden bg-slate-100 border border-white shadow-sm">
                          <img src={item.avatar} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">{item.name}</p>
                          <p className="truncate text-xs font-medium text-slate-500">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-bold text-slate-600">{item.workId}</span>
                    </td>
                    <td>
                      <span className={cn(
                        "ui-status-badge",
                        item.role === "super_admin" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-blue-50 text-blue-700 border-blue-100",
                      )}>
                        {roleLabelFor(item.role)}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-bold text-slate-600">{item.designation || item.roleLabel}</span>
                    </td>
                    <td>
                      <div className="text-xs font-bold text-slate-600">
                        <p>{item.phone || "-"}</p>
                        <p className="mt-1 text-slate-400">{item.location || "-"}</p>
                      </div>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "ui-status-badge gap-1.5",
                          item.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-rose-50 text-rose-700 border-rose-100",
                        )}
                      >
                        <ShieldCheck size={12} />
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="ui-action-cell">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          type="button"
                          disabled={!rowCanEdit}
                          className="ui-icon-btn disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Edit account"
                        >
                          <UserRoundPen size={15} />
                        </button>
                        <button
                          onClick={() => updateActive(item.id, !item.active)}
                          type="button"
                          disabled={!canToggleAccount(item)}
                          className={cn(
                            "ui-btn ui-btn-sm disabled:cursor-not-allowed disabled:opacity-40",
                            item.active
                              ? "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                          )}
                        >
                          {item.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => deleteAccount(item)}
                          type="button"
                          disabled={!canDeleteAccount(item)}
                          className="ui-icon-btn text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Delete account"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm font-bold text-slate-500">
                    {activeFilterCount ? "No users match the selected filters." : "No users found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="ui-card-list">
          {paginatedUsers.map((item) => {
            const rowCanEdit = canEditAccount(item);
            return (
              <article key={item.id} className="ui-mobile-record">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white bg-slate-100 shadow-sm">
                      <img src={item.avatar} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{item.name}</p>
                      <p className="truncate text-xs font-medium text-slate-500">{item.email}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "ui-status-badge",
                      item.active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100",
                    )}
                  >
                    {item.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Role</p>
                    <p className="mt-1 font-bold text-slate-700">{item.roleLabel}</p>
                  </div>
                  <div>
                    <p className="font-black uppercase tracking-widest text-slate-400">Work ID</p>
                    <p className="mt-1 font-mono font-bold text-slate-700">{item.workId}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => startEdit(item)}
                    type="button"
                    disabled={!rowCanEdit}
                    className="ui-btn ui-btn-sm ui-btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => updateActive(item.id, !item.active)}
                    type="button"
                    disabled={!canToggleAccount(item)}
                    className={cn(
                      "ui-btn ui-btn-sm flex-1 disabled:cursor-not-allowed disabled:opacity-40",
                      item.active
                        ? "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                    )}
                  >
                    {item.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteAccount(item)}
                    type="button"
                    disabled={!canDeleteAccount(item)}
                    className="ui-btn ui-btn-sm ui-btn-danger flex-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
          {!isLoading && filteredUsers.length === 0 && (
            <div className="p-8 text-center text-sm font-bold text-slate-500">
              {activeFilterCount ? "No users match the selected filters." : "No users found."}
            </div>
          )}
        </div>
        {filteredUsers.length > usersPerPage && (
          <nav className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" aria-label="User table pages">
            <p className="text-xs font-semibold text-slate-500">Page {effectivePage} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={effectivePage === 1}
                className="ui-icon-btn disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous user page"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-black transition-colors",
                    page === effectivePage
                      ? "border-blue-900 bg-blue-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-900",
                  )}
                  aria-label={`User page ${page}`}
                  aria-current={page === effectivePage ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={effectivePage === totalPages}
                className="ui-icon-btn disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next user page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </nav>
        )}
      </div>
      )}
      {editModal}
    </div>
  );
}
