const SUPABASE_URL = 'https://krihvhyexqstphxqkljr.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaWh2aHlleHFzdHBoeHFrbGpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM3NTQ0MCwiZXhwIjoyMDk4OTUxNDQwfQ.Gy7y_f5oGpr2ciEwVPwCihA8RyHbz0U8wwjkqd4wncQ';

const headers = { 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE };

async function api(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text || null; }
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${data?.msg || data?.error || text || 'Unknown error'}`);
  return data;
}

const sampleUsers = [
  { email: 'amina.bello@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Amina Bello' } },
  { email: 'chidi.okonkwo@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Chidi Okonkwo' } },
  { email: 'funke.adeyemi@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Funke Adeyemi' } },
  { email: 'emeka.nwachukwu@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Emeka Nwachukwu' } },
  { email: 'zainab.hassan@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Zainab Hassan' } },
  { email: 'tunde.oladipo@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Tunde Oladipo' } },
  { email: 'ngozi.eze@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Ngozi Eze' } },
  { email: 'kola.adebayo@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Kola Adebayo' } },
  { email: 'chioma.okoro@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Chioma Okoro' } },
  { email: 'ibrahim.danjuma@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Ibrahim Danjuma' } },
  { email: 'yetunde.oyelowo@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Yetunde Oyelowo' } },
  { email: 'uche.obi@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Uche Obi' } },
  { email: 'simon.agada@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Simon Agada' } },
  { email: 'grace.udoh@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Grace Udoh' } },
  { email: 'rasheed.balogun@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Rasheed Balogun' } },
  { email: 'adaeze.nnamdi@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Adaeze Nnamdi' } },
  { email: 'femi.ogunlesi@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Femi Ogunlesi' } },
  { email: 'hauwa.yusuf@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Hauwa Yusuf' } },
  { email: 'segun.alawode@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Segun Alawode' } },
  { email: 'temitope.ogunbiyi@example.com', password: 'SamplePass123!', user_metadata: { full_name: 'Temitope Ogunbiyi' } },
];

const profiles = [
  { full_name: 'Amina Bello', role: 'firm', company_name: 'Bello Technologies', bio: 'CEO with 15 years in fintech.', headline: 'CEO & Founder', location: 'Lagos, Nigeria', skills: ['Leadership', 'Fintech', 'Strategy', 'Product Management'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Chidi Okonkwo', role: 'student', bio: 'Computer Science graduate passionate about AI.', headline: 'AI/ML Engineer', location: 'Enugu, Nigeria', skills: ['Python', 'TensorFlow', 'Machine Learning', 'Data Science'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/chidiokonkwo' },
  { full_name: 'Funke Adeyemi', role: 'firm', company_name: 'Adeyemi Consulting', bio: 'Management consultant helping SMEs scale.', headline: 'Managing Partner', location: 'Abuja, Nigeria', skills: ['Business Strategy', 'Consulting', 'Operations', 'Finance'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Emeka Nwachukwu', role: 'student', bio: 'Full-stack developer and open-source contributor.', headline: 'Full-Stack Developer', location: 'Port Harcourt, Nigeria', skills: ['React', 'Node.js', 'TypeScript', 'GraphQL', 'Docker'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/emekanwachukwu' },
  { full_name: 'Zainab Hassan', role: 'firm', company_name: 'Hassan Creative Agency', bio: 'Creative director with award-winning design portfolio.', headline: 'Creative Director', location: 'Kano, Nigeria', skills: ['UI/UX Design', 'Branding', 'Graphic Design', 'Motion Graphics'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Tunde Oladipo', role: 'student', bio: 'DevOps engineer and cloud architect.', headline: 'DevOps Engineer', location: 'Ibadan, Nigeria', skills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/tundeoladipo' },
  { full_name: 'Ngozi Eze', role: 'firm', company_name: 'Eze Logistics Ltd', bio: 'Supply chain expert optimizing African trade routes.', headline: 'Supply Chain Director', location: 'Onitsha, Nigeria', skills: ['Logistics', 'Supply Chain', 'Operations', 'Trade'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Kola Adebayo', role: 'student', bio: 'Data scientist turning numbers into decisions.', headline: 'Data Scientist', location: 'Lagos, Nigeria', skills: ['Python', 'R', 'SQL', 'Tableau', 'Statistics'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/kolaadebayo' },
  { full_name: 'Chioma Okoro', role: 'firm', company_name: 'Okoro Tech Hub', bio: 'Tech entrepreneur building the next generation of African startups.', headline: 'Founder & CEO', location: 'Lagos, Nigeria', skills: ['Entrepreneurship', 'Product', 'Software Development', 'Venture Capital'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Ibrahim Danjuma', role: 'student', bio: 'Cybersecurity researcher and ethical hacker.', headline: 'Security Analyst', location: 'Kaduna, Nigeria', skills: ['Penetration Testing', 'Network Security', 'Python', 'Cryptography'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/ibrahimdanjuma' },
  { full_name: 'Yetunde Oyelowo', role: 'firm', company_name: 'Oyelowo Media', bio: 'Digital media strategist with 10+ years in broadcast.', headline: 'Media Director', location: 'Ikeja, Nigeria', skills: ['Digital Media', 'Content Strategy', 'Brand Management', 'PR'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Uche Obi', role: 'student', bio: 'Mobile app developer specializing in Flutter and React Native.', headline: 'Mobile Developer', location: 'Awka, Nigeria', skills: ['Flutter', 'React Native', 'Dart', 'Firebase', 'iOS', 'Android'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/ucheobi' },
  { full_name: 'Simon Agada', role: 'firm', company_name: 'Agada Farms Ltd', bio: 'Agritech innovator modernizing Nigerian farming.', headline: 'CEO & Founder', location: 'Makurdi, Nigeria', skills: ['Agriculture', 'Technology', 'Operations', 'Supply Chain'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Grace Udoh', role: 'student', bio: 'Product manager with a knack for user-centric design.', headline: 'Product Manager', location: 'Uyo, Nigeria', skills: ['Product Management', 'Agile', 'User Research', 'Analytics', 'Roadmapping'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Rasheed Balogun', role: 'firm', company_name: 'Balogun Properties', bio: 'Real estate developer focused on affordable housing.', headline: 'Managing Director', location: 'Ilorin, Nigeria', skills: ['Real Estate', 'Construction', 'Finance', 'Project Management'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Adaeze Nnamdi', role: 'student', bio: 'Blockchain developer and Web3 enthusiast.', headline: 'Blockchain Developer', location: 'Enugu, Nigeria', skills: ['Solidity', 'Ethereum', 'Web3.js', 'Smart Contracts', 'TypeScript'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/adaezennamdi' },
  { full_name: 'Femi Ogunlesi', role: 'firm', company_name: 'Ogunlesi Energy', bio: 'Renewable energy pioneer bringing solar to rural communities.', headline: 'CEO & Founder', location: 'Abeokuta, Nigeria', skills: ['Renewable Energy', 'Engineering', 'Sustainability', 'Project Finance'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Hauwa Yusuf', role: 'student', bio: 'UX researcher passionate about inclusive design.', headline: 'UX Researcher', location: 'Jos, Nigeria', skills: ['User Research', 'Usability Testing', 'Figma', 'Design Thinking', 'Accessibility'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Segun Alawode', role: 'firm', company_name: 'Alawode Legal', bio: 'Corporate lawyer specializing in tech and IP law.', headline: 'Partner & Legal Counsel', location: 'Lagos, Nigeria', skills: ['Corporate Law', 'Intellectual Property', 'Contracts', 'Compliance'], availability: 'open_to_work', preferred_currency: 'NGN' },
  { full_name: 'Temitope Ogunbiyi', role: 'student', bio: 'Backend engineer building scalable distributed systems.', headline: 'Backend Engineer', location: 'Ogbomoso, Nigeria', skills: ['Go', 'Rust', 'PostgreSQL', 'Redis', 'Microservices', 'gRPC'], availability: 'open_to_work', preferred_currency: 'NGN', github_url: 'https://github.com/temitopeogunbiyi' },
];

const orgsData = [
  { name: 'Bello Technologies', slug: 'bello-tech', industry: 'Technology', size: '50-100', description: 'Leading fintech company providing innovative payment solutions across West Africa.', website_url: 'https://bellotech.ng' },
  { name: 'Adeyemi Consulting', slug: 'adeyemi-consulting', industry: 'Consulting', size: '10-50', description: 'Management consulting firm helping SMEs scale.', website_url: 'https://adeyemiconsulting.com' },
  { name: 'Eze Logistics Ltd', slug: 'eze-logistics', industry: 'Logistics', size: '50-100', description: 'Supply chain and logistics company optimizing trade routes across Nigeria.', website_url: 'https://ezelogistics.ng' },
  { name: 'Okoro Tech Hub', slug: 'okoro-tech', industry: 'Technology', size: '10-50', description: 'Tech incubator building the next generation of African startups.', website_url: 'https://okorotech.com' },
  { name: 'Hassan Creative Agency', slug: 'hassan-creative', industry: 'Design', size: '10-50', description: 'Award-winning creative agency specializing in branding and design.', website_url: 'https://hassancreative.ng' },
];

// Org owner mapping: orgIndex -> profileIndex (owner must be firm role)
const orgOwnerMap = [
  { orgIdx: 0, userIdx: 0 },   // Bello Tech <- Amina Bello (firm)
  { orgIdx: 1, userIdx: 2 },   // Adeyemi Consulting <- Funke Adeyemi (firm)
  { orgIdx: 2, userIdx: 6 },   // Eze Logistics <- Ngozi Eze (firm)
  { orgIdx: 3, userIdx: 8 },   // Okoro Tech Hub <- Chioma Okoro (firm)
  { orgIdx: 4, userIdx: 4 },   // Hassan Creative <- Zainab Hassan (firm)
];

const teamMemberMap = [
  { orgIdx: 0, userIdx: 1, role: 'admin' },  // Chidi -> Bello Tech
  { orgIdx: 0, userIdx: 3, role: 'member' }, // Emeka -> Bello Tech
  { orgIdx: 1, userIdx: 5, role: 'admin' },  // Tunde -> Adeyemi Consulting
  { orgIdx: 1, userIdx: 7, role: 'member' }, // Kola -> Adeyemi Consulting
  { orgIdx: 2, userIdx: 9, role: 'admin' },  // Ibrahim -> Eze Logistics
  { orgIdx: 2, userIdx: 11, role: 'member' },// Uche -> Eze Logistics
  { orgIdx: 3, userIdx: 13, role: 'admin' }, // Grace -> Okoro Tech Hub
  { orgIdx: 3, userIdx: 15, role: 'member' },// Adaeze -> Okoro Tech Hub
  { orgIdx: 4, userIdx: 17, role: 'admin' }, // Hauwa -> Hassan Creative
  { orgIdx: 4, userIdx: 19, role: 'member' },// Temitope -> Hassan Creative
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== SEEDING SAMPLE DATA ===\n');

  // Step 1: Create auth users
  const createdUserIds = [];
  for (let i = 0; i < sampleUsers.length; i++) {
    const u = sampleUsers[i];
    process.stdout.write(`[${i+1}/${sampleUsers.length}] Auth: ${u.email}... `);
    try {
      const data = await api('POST', '/auth/v1/admin/users', u);
      createdUserIds.push(data.id);
      console.log(`OK (${data.id.slice(0,8)}...)`);
    } catch (e) {
      if (e.message.includes('already')) {
        console.log('EXISTS (skipping)');
        // Try fetching the existing user
        try {
          const search = await api('GET', `/auth/v1/admin/users?email=${encodeURIComponent(u.email)}`);
          if (search.users && search.users.length > 0) {
            createdUserIds.push(search.users[0].id);
          }
        } catch (e2) {
          console.log(`  -> Could not fetch existing: ${e2.message}`);
        }
      } else {
        console.log(`ERROR: ${e.message}`);
      }
    }
    await sleep(200); // Rate limit buffer
  }

  console.log(`\nAuth users: ${createdUserIds.length} ready\n`);

  // Step 2: Update profiles with full data (use PATCH since profiles are auto-created by trigger)
  for (let i = 0; i < createdUserIds.length; i++) {
    const uid = createdUserIds[i];
    const p = profiles[i];
    if (!uid || !p) continue;
    process.stdout.write(`Profile ${i+1}: ${p.full_name}... `);
    try {
      await api('PATCH', `/rest/v1/profiles?id=eq.${uid}`, {
        full_name: p.full_name,
        role: p.role,
        company_name: p.company_name || null,
        bio: p.bio || null,
        headline: p.headline || null,
        location: p.location || null,
        skills: p.skills || [],
        availability: p.availability || 'open_to_work',
        preferred_currency: p.preferred_currency || 'NGN',
        github_url: p.github_url || null,
        updated_at: new Date().toISOString(),
      });
      console.log('OK');
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    await sleep(100);
  }

  // Step 3: Get existing profiles (for org membership)
  const allProfiles = await api('GET', '/rest/v1/profiles?select=id,full_name,role&limit=50');
  const profilesList = Array.isArray(allProfiles) ? allProfiles : (allProfiles.data || []);
  const firmProfiles = profilesList.filter(p => p.role === 'firm');
  const studentProfiles = profilesList.filter(p => p.role === 'student');
  console.log(`\nTotal profiles: ${profilesList.length} (${firmProfiles.length} firms, ${studentProfiles.length} students)`);

  // Build user lookup map by name
  const profileByName = {};
  profilesList.forEach(p => { profileByName[p.full_name] = p; });

  // Step 4: Create organizations
  const createdOrgs = [];
  for (let i = 0; i < orgsData.length; i++) {
    const org = orgsData[i];
    const ownerInfo = orgOwnerMap[i];
    const ownerName = profiles[ownerInfo.userIdx].full_name;
    const ownerProfile = profileByName[ownerName];

    if (!ownerProfile) { console.log(`[ORG ${i+1}] Skipping ${org.name} - owner ${ownerName} not found`); continue; }

    process.stdout.write(`[ORG ${i+1}] ${org.name} (owner: ${ownerName})... `);
    try {
      const newOrg = await api('POST', '/rest/v1/organizations', {
        name: org.name,
        slug: org.slug,
        industry: org.industry,
        size: org.size,
        description: org.description,
        website_url: org.website_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      const orgRecord = Array.isArray(newOrg) ? newOrg[0] : newOrg;
      createdOrgs.push(orgRecord);
      console.log(`OK (${orgRecord.id.slice(0,8)}...)`);

      // Add owner as admin
      await api('POST', '/rest/v1/org_members', {
        org_id: orgRecord.id, user_id: ownerProfile.id, role: 'admin',
      });
      console.log(`  -> Owner ${ownerName} added as admin`);
    } catch (e) {
      if (e.message.includes('already') || e.message.includes('duplicate')) {
        console.log('EXISTS (fetching)');
        try {
          const existing = await api('GET', `/rest/v1/organizations?slug=eq.${org.slug}&select=*`);
          const orgRec = Array.isArray(existing) ? existing[0] : existing;
          if (orgRec) {
            createdOrgs.push(orgRec);
            // Ensure owner is member
            try {
              await api('POST', '/rest/v1/org_members', {
                org_id: orgRec.id, user_id: ownerProfile.id, role: 'admin',
              });
            } catch (mErr) { /* OK if already member */ }
          }
        } catch (e2) { console.log(`  -> Fetch error: ${e2.message}`); }
      } else {
        console.log(`ERROR: ${e.message}`);
      }
    }
    await sleep(200);
  }

  console.log(`\nOrganizations: ${createdOrgs.length}`);

  // Step 5: Add team members
  for (const tm of teamMemberMap) {
    const org = createdOrgs[tm.orgIdx];
    const memberName = profiles[tm.userIdx].full_name;
    const memberProfile = profileByName[memberName];

    if (!org || !memberProfile) {
      console.log(`  SKIP ${memberName} -> org ${tm.orgIdx} (missing)`);
      continue;
    }

    process.stdout.write(`  Adding ${memberName} as ${tm.role} to ${orgsData[tm.orgIdx].name}... `);
    try {
      await api('POST', '/rest/v1/org_members', {
        org_id: org.id, user_id: memberProfile.id, role: tm.role,
      });
      console.log('OK');
    } catch (e) {
      if (e.message.includes('duplicate')) { console.log('ALREADY MEMBER'); }
      else { console.log(`ERROR: ${e.message}`); }
    }
    await sleep(100);
  }

  // Step 6: Add existing pre-seed users to first org
  const preSeedProfiles = allProfiles.filter(p => !profiles.some(sp => sp.full_name === p.full_name));
  if (preSeedProfiles.length > 0 && createdOrgs[0]) {
    console.log(`\nAdding ${preSeedProfiles.length} pre-existing users to ${orgsData[0].name}:`);
    for (const pp of preSeedProfiles) {
      process.stdout.write(`  ${pp.full_name}... `);
      try {
        const { data: existingMember } = await api('GET', `/rest/v1/org_members?org_id=eq.${createdOrgs[0].id}&user_id=eq.${pp.id}&select=id`);
        if (!existingMember || existingMember.length === 0) {
          await api('POST', '/rest/v1/org_members', {
            org_id: createdOrgs[0].id, user_id: pp.id, role: 'member',
          });
          console.log('OK');
        } else {
          console.log('ALREADY MEMBER');
        }
      } catch (e) { console.log(`ERROR: ${e.message}`); }
    }
  }

  console.log('\n=== SEEDING COMPLETE ===');
  console.log(`Users created/verified: ${createdUserIds.length}`);
  console.log(`Organizations: ${createdOrgs.length}`);
  console.log(`\nLogin password for all sample users: SamplePass123!`);
}

main().catch(err => { console.error('\nFATAL:', err); process.exit(1); });
