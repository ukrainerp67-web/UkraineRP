# Security Specification for UKRAINE RP

## Data Invariants
1. Users can only edit their own profile.
2. Property and Vehicles must have a valid ownerId matching the creator or updated owner.
3. Mafia creation requires a social rating of -15 or less.
4. Political Party creation requires a social rating of +15 or more.
5. Marriage requires mutual consent (though simplified in this MVP as a field update).
6. Balance updates must be validated (no negative balances unless credit).

## The "Dirty Dozen" Payloads (Examples)
1. **Identity Spoofing**: Attempt to update `users/targetUID` with `request.auth.uid` pointing to another user.
2. **Wealth Injection**: Attempt to set `balance` to 999,999,999 without a corresponding transaction.
3. **Ghost Property**: Creating a property with `ownerId` of another user to "steal" or "assign" wrongly.
4. **Rating Manipulation**: Boosting `socialRating` to join a party without earning it.
5. **System Field Overwrite**: Changing `createdAt` or `id` fields.
6. **Large Payload Attack**: Sending a 1MB string in `firstName`.
7. **Unauthorized Deletion**: Deleting another user's business.
8. **Invalid ID**: Using symbols in document IDs.
9. **Private Message Leak**: Reading messages where `recipientId` doesn't match `auth.uid` and not global.
10. **Mafia Hack**: Joining a Mafia without the required -15 rating.
11. **Party Hack**: Joining a Party without the required +15 rating.
12. **Double Marriage**: Setting `partnerId` without the partner's consent (requires transaction or double verification).

## Test Runner (Logic)
The tests will verify that `PERMISSION_DENIED` is returned for all unauthorized operations.
