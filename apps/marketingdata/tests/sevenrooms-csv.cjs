const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'apps/marketingdata/node_modules/typescript')),exportsObject={};
new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/sevenrooms-csv.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exportsObject);
const {sevenRoomsCsv:parse,sevenRoomsHeader:header}=exportsObject;
test('CSV preserves long guest IDs, UTF-8 names, commas and multiline guest notes',()=>{
 const result=parse('\uFEFFGuest ID,Full Name,Notes\r\n6444077996425216,Arsa,"A note, with commas\nAnd ""quotes"""\r\n');assert.equal(result.records.length,1);assert.equal(result.records[0][0],'6444077996425216');assert.equal(result.records[0][2],'A note, with commas\nAnd "quotes"');
});
test('CSV rejects truncation, inconsistent columns and duplicate headings',()=>{
 assert.throws(()=>parse('name,email\n"unfinished'),/unfinished/);assert.throws(()=>parse('name,email\none'),/different number/);assert.throws(()=>parse('email,email\na,b'),/unique/);
});
test('SevenRooms CSV display headers map to the existing client schema without changing raw files',()=>{
 assert.equal(header('Venue Parent Group Guest Guest ID'),'Guest ID');assert.equal(header('Venue Parent Group Guest Marketing Opt In - Parent Group (Yes / No)'),'Marketing Opt In - Parent Group (Yes / No)');assert.equal(header('Venue Parent Group Guest List of Venues.'),'Marketing Opt in- Venue Names');assert.equal(header('Client User Venue User Full Name'),'Profile Created By Name');assert.equal(header('An additional source field'),'An additional source field');
});
test('large exports are supported beyond the old 10,000-row CSV limit',()=>{
 const text='Guest ID,Full Name\n'+Array.from({length:11001},(_,i)=>i+',Guest '+i).join('\n');assert.equal(parse(text).records.length,11001);
});
test('reservation CSV maps guest IDs, dates, consent and scores to existing import fields',()=>{
 assert.equal(header('Guests Guest ID (Reservation)'),'Guest ID');assert.equal(header('Guests Full Name (Reservation)'),'Full Name (Reservation)');assert.equal(header('Reservations Reservation - Local Date'),'Reservation Date');assert.equal(header('Reservations Reference Code'),'Confirmation #');assert.equal(header('Guests Marketing Opt In - Parent Group (Yes / No)'),'Marketing Opt In - Parent Group (Yes / No)');assert.equal(header('Reservation Feedback Feedback Notes'),'Feedback Notes');assert.equal(header('Reservation Feedback Service Score'),'Service Score');
});
