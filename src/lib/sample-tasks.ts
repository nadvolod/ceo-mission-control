import { Task } from './types';

// Sample tasks to seed the system based on Nikolay's current context
export const sampleTasks: Partial<Task>[] = [
  // Temporal - Mega Project
  {
    title: 'Complete client delivery sprint',
    description: 'Finish current sprint deliverables for major client',
    status: 'In Progress',
    priority: 'Critical',
    projectId: 'Temporal',
    estimatedHours: 8,
    tags: ['temporal', 'client-work']
  },
  {
    title: 'Schedule tomorrow\'s 6:30 AM focus block',
    description: 'Protect morning momentum for deep work',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Temporal',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    tags: ['temporal', 'scheduling']
  },
  
  // Financial Crisis / Immediate Cash
  {
    title: 'Contact Loan Depot about failed payment',
    description: 'Resolve failed payment issue to protect credit',
    status: 'Not Started',
    priority: 'Critical',
    projectId: 'Finance',
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
    tags: ['finance', 'urgent']
  },
  {
    title: 'Contact PennyMac about failed payment',
    description: 'Resolve failed payment issue to protect credit',
    status: 'Not Started',
    priority: 'Critical',
    projectId: 'Finance',
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
    tags: ['finance', 'urgent']
  },
  
  // HELOC - $75K liquidity
  {
    title: 'Follow up on Devonshire HELOC application',
    description: 'Push for completion of $75K equity line',
    status: 'Not Started',
    priority: 'Critical',
    projectId: 'HELOC',
    tags: ['finance', 'heloc']
  },
  
  // Artis WHO Contract - $12K
  {
    title: 'Send aggressive follow-up to Artis WHO',
    description: 'Push for $12K contract closure with timeline',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Revenue',
    tags: ['revenue', 'artis']
  },
  
  // Taxes - April 15 deadline
  {
    title: 'Complete tax preparation',
    description: 'File taxes by deadline',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Taxes',
    deadline: '2026-04-15',
    tags: ['taxes', 'deadline']
  },
  {
    title: 'Create missing tax documents checklist',
    description: 'List all required documents and assign ownership',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Taxes',
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
    tags: ['taxes', 'preparation']
  },
  
  // Alton Condo Move-out
  {
    title: 'Complete Alton condo move-out',
    description: 'Finalize move-out process and lease termination',
    status: 'In Progress',
    priority: 'High',
    projectId: 'Housing',
    deadline: '2026-03-30', // Assuming end of March based on context
    tags: ['housing', 'move-out']
  },
  {
    title: 'Email Erika - lease cancellation follow-up #3',
    description: 'Send third follow-up email about lease cancellation',
    status: 'Not Started',
    priority: 'Medium',
    projectId: 'Housing',
    tags: ['housing', 'communication']
  },
  
  // Tricentis Revenue
  {
    title: 'Follow up on Tricentis video course ($6.5K)',
    description: 'Push for decision and close on video course opportunity',
    status: 'Not Started',
    priority: 'Medium',
    projectId: 'Revenue',
    tags: ['revenue', 'tricentis']
  },
  {
    title: 'Schedule Tricentis webinar ($2K)',
    description: 'Lock date and finalize webinar details',
    status: 'Not Started',
    priority: 'Medium',
    projectId: 'Revenue',
    tags: ['revenue', 'tricentis']
  },
  
  // Tony Robbins Pitch - $100K+ opportunity
  {
    title: 'Prepare Tony Robbins pitch presentation',
    description: 'Create compelling pitch for $100K+ opportunity',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Revenue',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week
    tags: ['revenue', 'tony-robbins']
  },
  
  // Miami Move Planning
  {
    title: 'Research Miami rental options',
    description: 'Find high-quality South Beach properties with professional management',
    status: 'Not Started',
    priority: 'Medium',
    projectId: 'Miami Move',
    tags: ['housing', 'miami']
  },
  
  // Personal/Health
  {
    title: 'Order new skate straps',
    description: 'Replace broken skate straps',
    status: 'Not Started',
    priority: 'Low',
    projectId: 'Personal',
    tags: ['personal', 'equipment']
  },
  {
    title: 'Book Temporal Replay conference hotel',
    description: 'Complete hotel booking - waiting for CC info',
    status: 'Blocked',
    priority: 'Medium',
    projectId: 'Travel',
    blockedReason: 'Waiting for credit card information',
    tags: ['travel', 'conference']
  }
];

export const sampleTemporalSubTasks: Partial<Task>[] = [
  {
    title: 'Review current sprint backlog',
    description: 'Assess remaining work for current sprint',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Temporal',
    parentTaskId: 'temporal-client-delivery',
    tags: ['temporal', 'sprint-planning']
  },
  {
    title: 'Complete API integration tests',
    description: 'Finish writing and running integration tests',
    status: 'In Progress',
    priority: 'High',
    projectId: 'Temporal',
    parentTaskId: 'temporal-client-delivery',
    estimatedHours: 4,
    tags: ['temporal', 'testing']
  },
  {
    title: 'Deploy to staging environment',
    description: 'Deploy latest changes to staging for client review',
    status: 'Not Started',
    priority: 'High',
    projectId: 'Temporal',
    parentTaskId: 'temporal-client-delivery',
    tags: ['temporal', 'deployment']
  },
  {
    title: 'Client demo preparation',
    description: 'Prepare presentation for client demo meeting',
    status: 'Not Started',
    priority: 'Medium',
    projectId: 'Temporal',
    parentTaskId: 'temporal-client-delivery',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days
    tags: ['temporal', 'presentation']
  }
];