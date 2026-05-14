import { NextRequest, NextResponse } from 'next/server';
import { ChatSyncManager } from '@/lib/chat-sync';
import { checkAuth } from '@/lib/auth';
import { requireEffectiveUserId } from '@/lib/session';

// Cache per ownerId — never share a manager across users. The previous
// process-global cache captured the first caller's ownerId and silently
// wrote subsequent users' chat updates to that user's trackers.
const chatSyncManagers = new Map<string, Promise<ChatSyncManager>>();
async function getChatSyncManager(ownerId: string) {
  let p = chatSyncManagers.get(ownerId);
  if (!p) {
    p = ChatSyncManager.create(ownerId);
    chatSyncManagers.set(ownerId, p);
  }
  return p;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('Processing chat sync for message:', message);
    const ownerId = await requireEffectiveUserId();
    const manager = await getChatSyncManager(ownerId);
    const result = await manager.syncChatUpdate(message);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Synced: ${result.tasks?.updated?.length || 0} task(s) updated, ${result.tasks?.created?.length || 0} created${result.financial?.added?.length ? `, ${result.financial.added.length} financial entries` : ''}${result.focusHours?.added?.length ? `, ${result.focusHours.added.length} focus session(s)` : ''}`
    });
  } catch (error) {
    console.error('Error in chat sync:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync chat update' },
      { status: 500 }
    );
  }
}
