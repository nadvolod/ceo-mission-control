import { NextRequest, NextResponse } from 'next/server';
import { chatSyncManager } from '@/lib/chat-sync';

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
    
    const result = await chatSyncManager.syncChatUpdate(message);
    
    return NextResponse.json({
      success: true,
      updated: result.updated,
      created: result.created,
      financial: result.financial,
      message: `Updated ${result.updated.length} tasks, created ${result.created.length} tasks${result.financial?.added?.length ? `, tracked ${result.financial.added.length} financial entries` : ''}`
    });
    
  } catch (error) {
    console.error('Error in chat sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync chat update', details: error.message },
      { status: 500 }
    );
  }
}