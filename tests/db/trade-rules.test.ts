import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, bootLatest, count, createUser, insertListing } from './harness';

// The rules from 016 and 021, tested through RLS as a signed-in client would hit them.
describe('trade rules', () => {
  let db: PGlite;
  let seller: string;
  let buyer: string;
  let stranger: string;

  async function startConversation(overrides: Record<string, unknown> = {}) {
    const listing = await insertListing(db, seller, overrides);
    const { rows } = await asUser(db, buyer, () =>
      db.query<{ id: string }>(
        `insert into public.conversations (listing_id, buyer_id, seller_id) values ($1, $2, $3) returning id`,
        [listing, buyer, seller]
      )
    );
    return { listing, conversation: rows[0].id };
  }

  async function sendOffer(conversation: string, from: string, amount = 5) {
    const { rows } = await asUser(db, from, () =>
      db.query<{ id: string }>(
        `insert into public.messages (conversation_id, sender_id, content, message_type, offer_amount, offer_status)
         values ($1, $2, '', 'offer', $3, 'pending') returning id`,
        [conversation, from, amount]
      )
    );
    return rows[0].id;
  }

  const status = async (id: string) =>
    (await db.query<{ status: string }>('select status from public.conversations where id = $1', [id])).rows[0].status;

  beforeAll(async () => {
    db = await bootLatest();
    seller = await createUser(db, 'seller');
    buyer = await createUser(db, 'buyer');
    stranger = await createUser(db, 'stranger');
  });

  describe('starting a conversation', () => {
    it('works on someone else\'s active listing and tells the seller', async () => {
      const { conversation } = await startConversation();
      expect(await count(db, `public.messages where conversation_id = $1 and message_type = 'system'`, [conversation])).toBe(1);
      expect(await count(db, `public.notifications where user_id = $1 and conversation_id = $2`, [seller, conversation])).toBe(1);
    });

    it('is refused on your own listing', async () => {
      const listing = await insertListing(db, seller);
      await asUser(db, seller, async () => {
        await expect(
          db.query(`insert into public.conversations (listing_id, buyer_id, seller_id) values ($1, $2, $2)`, [listing, seller])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('is refused when naming the wrong seller', async () => {
      const listing = await insertListing(db, seller);
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.conversations (listing_id, buyer_id, seller_id) values ($1, $2, $3)`, [listing, buyer, stranger])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('is refused on a sold listing', async () => {
      const listing = await insertListing(db, seller, { is_active: false });
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.conversations (listing_id, buyer_id, seller_id) values ($1, $2, $3)`, [listing, buyer, seller])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('is refused for a status other than active', async () => {
      const listing = await insertListing(db, seller);
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.conversations (listing_id, buyer_id, seller_id, status) values ($1, $2, $3, 'completed')`, [listing, buyer, seller])
        ).rejects.toThrow(/row-level security/);
      });
    });
  });

  describe('messages and offers', () => {
    it('notifies the other side of a message', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, () =>
        db.query(`insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'hi')`, [conversation, buyer])
      );
      expect(await count(db, `public.notifications where user_id = $1 and conversation_id = $2 and type = 'new_message'`, [seller, conversation])).toBe(2);
    });

    it('stops clients posting system messages', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.messages (conversation_id, sender_id, content, message_type) values ($1, null, 'Offer accepted', 'system')`, [conversation])
        ).rejects.toThrow(/row-level security/);
        await expect(
          db.query(`insert into public.messages (conversation_id, sender_id, content, message_type) values ($1, $2, 'Offer accepted', 'system')`, [conversation, buyer])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('stops outsiders posting', async () => {
      const { conversation } = await startConversation();
      await asUser(db, stranger, async () => {
        await expect(
          db.query(`insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'hi')`, [conversation, stranger])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('refuses an offer that is not positive or already decided', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(
          db.query(
            `insert into public.messages (conversation_id, sender_id, content, message_type, offer_amount, offer_status)
             values ($1, $2, '', 'offer', 0, 'pending')`,
            [conversation, buyer]
          )
        ).rejects.toThrow(/row-level security/);
        await expect(
          db.query(
            `insert into public.messages (conversation_id, sender_id, content, message_type, offer_amount, offer_status)
             values ($1, $2, '', 'offer', 5, 'accepted')`,
            [conversation, buyer]
          )
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('refuses editing a sent message', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, buyer, async () => {
        await expect(db.query(`update public.messages set offer_amount = 1 where id = $1`, [offer])).rejects.toThrow(/cannot be edited/);
      });
    });
  });

  describe('deciding offers', () => {
    it('accepting closes the conversation, logs it and tells the sender', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, () => db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [offer]));
      expect(await status(conversation)).toBe('accepted');
      expect(await count(db, `public.messages where conversation_id = $1 and content = 'Offer accepted'`, [conversation])).toBe(1);
      expect(await count(db, `public.notifications where user_id = $1 and type = 'offer_accepted'`, [buyer])).toBeGreaterThan(0);
    });

    it('declining closes it too', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, () => db.query(`update public.messages set offer_status = 'declined' where id = $1`, [offer]));
      expect(await status(conversation)).toBe('declined');
    });

    it('countering keeps it open', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, () => db.query(`update public.messages set offer_status = 'countered' where id = $1`, [offer]));
      expect(await status(conversation)).toBe('active');
    });

    it('you cannot decide your own offer', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, buyer, async () => {
        await expect(db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [offer])).rejects.toThrow(/your own offer/);
      });
    });

    it('a decided offer stays decided', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, async () => {
        await db.query(`update public.messages set offer_status = 'countered' where id = $1`, [offer]);
        await expect(db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [offer])).rejects.toThrow(/pending offer/);
      });
    });

    it('offers cannot be decided once the conversation closes', async () => {
      const { conversation } = await startConversation();
      const first = await sendOffer(conversation, buyer, 5);
      const second = await sendOffer(conversation, buyer, 6);
      await asUser(db, seller, async () => {
        await db.query(`update public.messages set offer_status = 'declined' where id = $1`, [first]);
        await expect(db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [second])).rejects.toThrow(/closed/);
      });
    });
  });

  describe('conversation status', () => {
    it('cannot be set to accepted without an offer', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(db.query(`update public.conversations set status = 'accepted' where id = $1`, [conversation])).rejects.toThrow(/cannot be changed/);
      });
    });

    it('moves from accepted to completed and tells the other side', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, () => db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [offer]));
      await asUser(db, buyer, () => db.query(`update public.conversations set status = 'completed' where id = $1`, [conversation]));
      expect(await status(conversation)).toBe('completed');
      expect(await count(db, `public.notifications where user_id = $1 and conversation_id = $2 and type = 'trade_completed'`, [seller, conversation])).toBe(1);
    });

    it('cannot be reassigned', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(db.query(`update public.conversations set seller_id = $1 where id = $2`, [stranger, conversation])).rejects.toThrow(/reassigned/);
      });
    });

    it('selling a listing cancels its open conversations and keeps it visible to the buyer', async () => {
      const { listing, conversation } = await startConversation();
      await asUser(db, seller, () => db.query(`update public.trade_listings set is_active = false where id = $1`, [listing]));
      expect(await status(conversation)).toBe('cancelled');
      await asUser(db, buyer, async () => {
        expect(await count(db, 'public.trade_listings where id = $1', [listing])).toBe(1);
      });
    });
  });

  describe('locked tables', () => {
    it('notifications cannot be forged', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.notifications (user_id, type, conversation_id, message) values ($1, 'new_message', $2, 'fake')`, [seller, conversation])
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('the price cache cannot be rewritten', async () => {
      await asUser(db, buyer, async () => {
        await expect(
          db.query(`insert into public.card_prices (card_id, card_name, price_mid) values ('x-1', 'x', 1)`)
        ).rejects.toThrow(/row-level security/);
      });
    });

    it('internal helpers are not callable', async () => {
      await asUser(db, buyer, async () => {
        await expect(db.query('select public.tb_mark_internal()')).rejects.toThrow(/permission denied/);
        await expect(db.query('select public.tb_mark_syncing()')).rejects.toThrow(/permission denied/);
      });
    });
  });

  describe('meet at shop', () => {
    let shop: string;
    let hiddenShop: string;

    beforeAll(async () => {
      const a = await db.query<{ id: string }>(
        `insert into public.shops (slug, name, town, status) values ('test-shop', 'Test Shop', 'Testville', 'active') returning id`
      );
      const b = await db.query<{ id: string }>(
        `insert into public.shops (slug, name, status) values ('draft-shop', 'Draft Shop', 'draft') returning id`
      );
      shop = a.rows[0].id;
      hiddenShop = b.rows[0].id;
    });

    const meet = async (id: string) =>
      (await db.query<{ meet_status: string }>('select meet_status from public.conversations where id = $1', [id])).rows[0].meet_status;

    it('only shows active shops', async () => {
      await asUser(db, null, async () => {
        expect(await count(db, 'public.shops')).toBe(1);
      });
    });

    it('stops clients adding or editing shops', async () => {
      await asUser(db, buyer, async () => {
        await expect(db.query(`insert into public.shops (slug, name) values ('fake', 'Fake')`)).rejects.toThrow(/row-level security/);
        const update = await db.query(`update public.shops set name = 'Hacked'`);
        expect(update.affectedRows).toBe(0);
      });
    });

    it('one side proposes, the other agrees, both are told', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, () => db.query(`select public.propose_meet($1, $2)`, [conversation, shop]));
      expect(await meet(conversation)).toBe('proposed');
      expect(await count(db, `public.messages where conversation_id = $1 and content = 'Suggested meeting at Test Shop'`, [conversation])).toBe(1);
      await asUser(db, seller, () => db.query(`select public.respond_meet($1, true)`, [conversation]));
      expect(await meet(conversation)).toBe('agreed');
      expect(await count(db, `public.notifications where user_id = $1 and conversation_id = $2 and message = 'Meeting agreed at Test Shop'`, [buyer, conversation])).toBe(1);
    });

    it('the proposer cannot agree with themself', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await db.query(`select public.propose_meet($1, $2)`, [conversation, shop]);
        await expect(db.query(`select public.respond_meet($1, true)`, [conversation])).rejects.toThrow(/other trader/);
      });
    });

    it('outsiders and draft shops are refused', async () => {
      const { conversation } = await startConversation();
      await asUser(db, stranger, async () => {
        await expect(db.query(`select public.propose_meet($1, $2)`, [conversation, shop])).rejects.toThrow(/unavailable/);
      });
      await asUser(db, buyer, async () => {
        await expect(db.query(`select public.propose_meet($1, $2)`, [conversation, hiddenShop])).rejects.toThrow(/not available/);
      });
    });

    it('a past time is refused', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(db.query(`select public.propose_meet($1, $2, now() - interval '1 day')`, [conversation, shop])).rejects.toThrow(/future/);
      });
    });

    it('works after acceptance but not once the trade is closed', async () => {
      const { conversation } = await startConversation();
      const offer = await sendOffer(conversation, buyer);
      await asUser(db, seller, () => db.query(`update public.messages set offer_status = 'accepted' where id = $1`, [offer]));
      await asUser(db, buyer, () => db.query(`select public.propose_meet($1, $2)`, [conversation, shop]));
      expect(await meet(conversation)).toBe('proposed');
      await asUser(db, buyer, () => db.query(`update public.conversations set status = 'completed' where id = $1`, [conversation]));
      await asUser(db, seller, async () => {
        await expect(db.query(`select public.respond_meet($1, true)`, [conversation])).rejects.toThrow(/closed/);
      });
    });

    it('the meet columns cannot be written directly', async () => {
      const { conversation } = await startConversation();
      await asUser(db, buyer, async () => {
        await expect(db.query(`update public.conversations set meet_status = 'agreed' where id = $1`, [conversation])).rejects.toThrow(/meet at shop/);
      });
      const listing = await insertListing(db, seller);
      const { rows } = await asUser(db, buyer, () =>
        db.query<{ meet_status: string }>(
          `insert into public.conversations (listing_id, buyer_id, seller_id, meet_status, meet_shop_id)
           values ($1, $2, $3, 'agreed', $4) returning meet_status`,
          [listing, buyer, seller, shop]
        )
      );
      expect(rows[0].meet_status).toBe('none');
    });

    it('home shops are yours to set', async () => {
      await asUser(db, buyer, async () => {
        await db.query(`insert into public.user_shops (user_id, shop_id) values ($1, $2)`, [buyer, shop]);
        await expect(db.query(`insert into public.user_shops (user_id, shop_id) values ($1, $2)`, [seller, shop])).rejects.toThrow(/row-level security/);
      });
    });
  });
});
