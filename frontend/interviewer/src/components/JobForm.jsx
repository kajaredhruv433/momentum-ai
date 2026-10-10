import React from 'react';
import { Briefcase, Building2, Award, GraduationCap, DollarSign, FileText, Users } from 'lucide-react';

export default function JobForm({ formData, onChange, disabled }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...formData, [name]: value });
  };

  return (
    <div className="card setup-card left-column">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}>01</span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Company & Job Profile</h3>
        </div>
        <span style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', color: '#94a3b8' }}>Target Role</span>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="company_name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={15} color="#60a5fa" /> Company Name
          </label>
          <input
            type="text"
            id="company_name"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            placeholder="e.g. Acme Technologies"
            disabled={disabled}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="role" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={15} color="#60a5fa" /> Role Required
          </label>
          <input
            type="text"
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            placeholder="e.g. Python Developer"
            disabled={disabled}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="required_skills" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={15} color="#60a5fa" /> Skills Required
          </label>
          <input
            type="text"
            id="required_skills"
            name="required_skills"
            value={formData.required_skills}
            onChange={handleChange}
            placeholder="Python, FastAPI, PostgreSQL, Redis, REST APIs..."
            disabled={disabled}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="required_experience">Experience</label>
            <input
              type="text"
              id="required_experience"
              name="required_experience"
              value={formData.required_experience}
              onChange={handleChange}
              placeholder="e.g. 2-4 years"
              disabled={disabled}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="salary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={15} color="#60a5fa" /> Salary
            </label>
            <input
              type="text"
              id="salary"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              placeholder="e.g. 10-15 LPA / Not Disclosed"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="required_qualification" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GraduationCap size={15} color="#60a5fa" /> Qualification
          </label>
          <input
            type="text"
            id="required_qualification"
            name="required_qualification"
            value={formData.required_qualification}
            onChange={handleChange}
            placeholder="B.Tech / B.E. in Computer Science"
            disabled={disabled}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="role_description" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={15} color="#60a5fa" /> Description
          </label>
          <textarea
            id="role_description"
            name="role_description"
            rows="3"
            value={formData.role_description}
            onChange={handleChange}
            placeholder="Backend development, API architecture, high throughput systems..."
            disabled={disabled}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="employee_qualities" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={15} color="#60a5fa" /> Employee Qualities
          </label>
          <input
            type="text"
            id="employee_qualities"
            name="employee_qualities"
            value={formData.employee_qualities}
            onChange={handleChange}
            placeholder="Problem solving, ownership, communication..."
            disabled={disabled}
            required
          />
        </div>
      </div>
    </div>
  );
}
