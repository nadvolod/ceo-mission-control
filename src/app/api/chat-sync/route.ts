import { NextRequest, NextResponse } from 'next/server';
import { ChatSyncManager } from '@/lib/chat-sync';

let chatSyncManagerPromise: Promise<ChatSyncManager> | null = null;
function getChatSyncManager() {
  if (!chatSyncManagerPromise) {
    chatSyncManagerPromise = ChatSyncManager.create();
  }
  return chatSyncManagerPromise;
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('Processing chat sync for message:', message);

    const manager = await getChatSyncManager();
    const result = await manager.syncChatUpdate(message);

    return NextResponse.json({
      success: true,
      updated: result.updated,
      created: result.created,
      financial: result.financial,
      focusHours: result.focusHours,
      message: `Updated ${result.updated.length} tasks, created ${result.created.length} tasks${result.financial?.added?.length ? `, tracked ${result.financial.added.length} financial entries` : ''}${result.focusHours?.added?.length ? `, logged ${result.focusHours.added.length} focus session(s)` : ''}`
    });

  } catch (error) {
    console.error('Error in chat sync:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync chat update', details: (error as Error).message },
      { status: 500 }
    );
  }
}