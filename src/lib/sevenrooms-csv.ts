/** Parse SevenRooms/Looker CSV without rounding IDs or losing quoted multiline notes. */
export function sevenRoomsCsv(text:string){
 text=text.replace(/^\uFEFF/,'');
 if(text.length>30000000)throw new Error('Choose an export smaller than 30 MB.');
 const records:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++;}
   else if(!cell||quoted)quoted=!quoted;
   else throw new Error('The CSV contains invalid quoting. Export it again.');
  }else if(char===','&&!quoted){row.push(cell);cell='';}
  else if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);if(row.some(value=>value.trim()))records.push(row);row=[];cell='';
  }else cell+=char;
 }
 if(quoted)throw new Error('The CSV contains an unfinished quoted field.');
 row.push(cell);if(row.some(value=>value.trim()))records.push(row);
 const headers=records.shift()?.map(value=>value.trim())||[];
 if(!headers.length||headers.length>150||new Set(headers).size!==headers.length||headers.some(value=>!value||['__proto__','prototype','constructor'].includes(value)))throw new Error('The CSV needs unique, non-empty column headings.');
 if(records.length>100000)throw new Error('Import up to 100,000 rows per file.');
 for(let index=0;index<records.length;index++)if(records[index].length!==headers.length)throw new Error('CSV row '+(index+2)+' has a different number of columns.');
 return {headers,records};
}

export function sevenRoomsHeader(header:string){
 const exact:Record<string,string>={
  'Client User Venue User Full Name':'Profile Created By Name',
  'Client User Venue User Email':'Profile Created By Email',
  'Venue Parent Group Guest List of Venues.':'Marketing Opt in- Venue Names',
  'Venue Parent Group Guest Client Tag Category + Name.':'Client Tag Categories + Names',
  'Venue Parent Group Guest Total Net Spend (Local)':'Total Net Spend',
  'Reservations Shift Name 2':'Shift Name',
  'Reservations Reservation Created - Local Date':'Created Date',
  'Reservations Reservation Created - Local Time':'Created Time',
  'Reservations Reservation - Local Date':'Reservation Date',
  'Reservations Reservation - Local Time':'Reservation Time',
  'Reservations Reservation Status - Grouped (4-tier)':'Reservation Status',
  'Reservations Reservation Status - Raw':'Reservation Status - Raw',
  'Reservations Reference Code':'Confirmation #',
  'Booked By Booked By - Raw Name':'Booked By',
  'Reservations Note':'Reservation Notes',
  'Reservations Booked Covers':'Booked Covers',
  'Reservations Reservation Tag Categories + Names':'Reservation Tag Categories + Names',
  'Guests Phone Number (Reservation)':'Phone Number',
  'Guests Guest Email (Reservation)':'Guest Email',
  'Guests Birthday Date (Reservation)':'Birthday',
  'Guests Notes':'Client Notes',
  'Guests Guest ID (Reservation)':'Guest ID',
  'Reservations Hours Cancelled In Advance':'Hours Cancelled In Advance',
  'Marketing Opt In Venues List of Venues':'Marketing Opt in- Venue Names',
  'Client Tags Client Tag Categories + Names':'Client Tag Categories + Names',
  'Reservation Concierge Client Requests':'Client Requests'
 };
 return exact[header]||header.replace(/^(Venue Parent Group Guest |Guests |Reservation Feedback )/,'');
}
