function testWeek() {
    const y = 2026;
    [1, 2, 52, 53].forEach(w => {
        const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
        const dow = simple.getUTCDay();
        const ISOweekStart = new Date(simple.valueOf());
        if (dow <= 4) {
          ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
        } else {
          ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
        }
        const startStr = ISOweekStart.toISOString().split('T')[0];
        
        const ISOweekEnd = new Date(ISOweekStart.valueOf());
        ISOweekEnd.setUTCDate(ISOweekStart.getUTCDate() + 6);
        const endStr = ISOweekEnd.toISOString().split('T')[0];
        console.log(`Year ${y} Week ${w}: ${startStr} to ${endStr}`);
    });
}
testWeek();
